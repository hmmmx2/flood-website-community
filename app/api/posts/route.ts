import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { javaFetch } from "@/lib/javaApi";
import { withCache, CACHE_TTL } from "@/lib/redis";

export const dynamic = "force-dynamic";

/**
 * Cheap probe for whether the caller has a NextAuth session cookie.
 *
 * Why this matters (2026-05-22 perf fix): the previous code ran
 * `await auth()` on EVERY GET — even for anonymous home-feed loads.
 * That added 100-300 ms per request to resolve a session that, for
 * cache-hit anonymous paths, ended up doing nothing. Reading just the
 * presence of the session cookie before any session-store work lets
 * us short-circuit the anonymous case straight to the Redis cache.
 *
 * NextAuth v5 cookie names: `__Secure-authjs.session-token` in
 * production (HTTPS, prefixed), `authjs.session-token` in dev. We
 * accept either so this works in both environments.
 */
function hasSessionCookie(req: NextRequest): boolean {
  return (
    !!req.cookies.get("__Secure-authjs.session-token") ||
    !!req.cookies.get("authjs.session-token")
  );
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const rawSort = searchParams.get("sort") ?? "new";
    const sort = rawSort === "top" ? "top" : "new";

    const rawSize = parseInt(searchParams.get("size") ?? "20", 10);
    const size = Math.max(1, Math.min(isNaN(rawSize) ? 20 : rawSize, 100));

    const rawPage = parseInt(searchParams.get("page") ?? "0", 10);
    const page = Math.max(0, isNaN(rawPage) ? 0 : rawPage);

    const group = searchParams.get("group") ?? "";
    const search = searchParams.get("search") ?? "";

    const params = new URLSearchParams({ page: String(page), size: String(size), sort });
    if (group)  params.set("group",  encodeURIComponent(group));
    if (search) params.set("search", encodeURIComponent(search));

    // Hot path — anonymous visitor. Skip auth() entirely and serve
    // from the shared cache. This is by far the most common case
    // (every signed-out home-feed visit), and the previous always-
    // call-auth() path made it ~300 ms slower than necessary.
    if (!hasSessionCookie(req)) {
      const cacheKey = `posts:${page}:${sort}:${group}:${search}`;
      const data = await withCache(cacheKey, CACHE_TTL.posts, () =>
        javaFetch<unknown>(`/community/posts?${params}`),
      );
      return NextResponse.json(data);
    }

    // Authenticated path — resolve the session so we can pass the
    // bearer token to Java and receive a user-specific response
    // (Java populates likedByMe and personalises ordering). Cache
    // deliberately skipped here because the response varies per
    // user; caching it would leak one user's likes to another.
    const session = await auth();
    const token = session?.accessToken;
    const data = await javaFetch<unknown>(`/community/posts?${params}`, { token });
    return NextResponse.json(data);
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed" }, { status });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await req.json();
    const data = await javaFetch<unknown>("/community/posts", { method: "POST", body, token: session.accessToken });
    return NextResponse.json(data);
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed" }, { status });
  }
}
