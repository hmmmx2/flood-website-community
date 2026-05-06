import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { javaFetch } from "@/lib/javaApi";
import { withCache, CACHE_TTL } from "@/lib/redis";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth();
  const token = session?.accessToken;
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

    const fetcher = () => javaFetch<unknown>(`/community/posts?${params}`, { token });

    // Skip cache for authenticated users — response includes user-specific likedByMe field
    let data: unknown;
    if (token) {
      data = await fetcher();
    } else {
      const cacheKey = `posts:${page}:${sort}:${group}:${search}`;
      data = await withCache(cacheKey, CACHE_TTL.posts, fetcher);
    }

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
