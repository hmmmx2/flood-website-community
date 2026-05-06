import { NextResponse } from "next/server";
import { javaFetch } from "@/lib/javaApi";
import { withCache, CACHE_TTL } from "@/lib/redis";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await withCache("blogs:categories", CACHE_TTL.blogs, () =>
      javaFetch<string[]>("/blogs/categories"),
    );
    return NextResponse.json(Array.isArray(data) ? data : []);
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number };
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
