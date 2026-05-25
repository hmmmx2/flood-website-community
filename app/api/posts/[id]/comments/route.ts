import { NextRequest, NextResponse } from "next/server";
import { getServerAccessToken, requireServerAccessToken } from "@/lib/serverAuth";
import { javaFetch } from "@/lib/javaApi";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = await getServerAccessToken(req);
  const { searchParams } = new URL(req.url);
  const sort = searchParams.get("sort") ?? "new";
  const safeSort = sort === "top" || sort === "old" ? sort : "new";
  const page = Math.max(0, parseInt(searchParams.get("page") ?? "0", 10) || 0);
  const size = Math.max(1, Math.min(parseInt(searchParams.get("size") ?? "20", 10) || 20, 50));
  const qs = new URLSearchParams({ sort: safeSort, page: String(page), size: String(size) });
  try {
    const data = await javaFetch<unknown>(`/community/posts/${id}/comments?${qs}`, { token: token ?? undefined });
    return NextResponse.json(data);
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed" }, { status });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = await requireServerAccessToken(req);
  if (token instanceof NextResponse) return token;
  try {
    const body = await req.json();
    const data = await javaFetch<unknown>(`/community/posts/${id}/comments`, {
      method: "POST",
      body,
      token: token,
    });
    return NextResponse.json(data);
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed" }, { status });
  }
}
