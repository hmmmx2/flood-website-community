import { NextRequest, NextResponse } from "next/server";
import { javaFetch, extractToken } from "@/lib/javaApi";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    // Whitelist sort — only "new" or "top" are valid
    const rawSort = searchParams.get("sort") ?? "new";
    const sort = rawSort === "top" ? "top" : "new";

    // Clamp size to 1–100
    const rawSize = parseInt(searchParams.get("size") ?? "20", 10);
    const size = Math.max(1, Math.min(isNaN(rawSize) ? 20 : rawSize, 100));

    // Sanitise page — must be a non-negative integer
    const rawPage = parseInt(searchParams.get("page") ?? "0", 10);
    const page = Math.max(0, isNaN(rawPage) ? 0 : rawPage);

    const group = searchParams.get("group") ?? "";
    const search = searchParams.get("search") ?? "";
    const token = extractToken(req.headers.get("authorization"));

    const params = new URLSearchParams({ page: String(page), size: String(size), sort });
    if (group)  params.set("group",  encodeURIComponent(group));
    if (search) params.set("search", encodeURIComponent(search));

    const data = await javaFetch<unknown>(`/community/posts?${params}`, { token });
    return NextResponse.json(data);
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed" }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = extractToken(req.headers.get("authorization"));
    const body = await req.json();
    const data = await javaFetch<unknown>("/community/posts", { method: "POST", body, token });
    return NextResponse.json(data);
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed" }, { status });
  }
}
