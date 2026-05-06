import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { javaFetch } from "@/lib/javaApi";
import { withCache, CACHE_TTL } from "@/lib/redis";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const session = await auth();
  const token = session?.accessToken;
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

    const data = await withCache(cacheKey, CACHE_TTL.blogs, () => javaFetch(path, { token }));
    return NextResponse.json(data);
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number };
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
