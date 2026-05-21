import { NextRequest, NextResponse } from "next/server";
import { javaFetch } from "@/lib/javaApi";
import { withCache, CACHE_TTL } from "@/lib/redis";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/blogs — public blog list.
 *
 * Performance (2026-05-22): deliberately does NOT call `auth()`. The
 * blog list is a fully public endpoint per the Java service's
 * SecurityConfig (`permitAll` on `/blogs`), and the response is the
 * same for every caller. Calling `auth()` here used to add 100-300 ms
 * per request just to resolve a session whose accessToken was then
 * forwarded but never affected the upstream response. Removing it
 * lets the cache layer serve requests in well under a second.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const rawPage = parseInt(searchParams.get("page") ?? "0", 10);
    const page = Math.max(0, isNaN(rawPage) ? 0 : rawPage);
    const rawSize = parseInt(searchParams.get("size") ?? "20", 10);
    const size = Math.max(1, Math.min(isNaN(rawSize) ? 20 : rawSize, 100));
    const category = searchParams.get("category");

    let path = `/blogs?page=${page}&size=${size}`;
    if (category && category !== "All") path += `&category=${encodeURIComponent(category)}`;

    const cat = (category && category !== "All") ? category : "all";
    const cacheKey = `blogs:${page}:${size}:${cat}`;

    const data = await withCache(cacheKey, CACHE_TTL.blogs, () => javaFetch(path));
    return NextResponse.json(data);
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number };
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
