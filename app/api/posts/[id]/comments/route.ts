import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { javaFetch } from "@/lib/javaApi";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const token = session?.accessToken;
  const { searchParams } = new URL(req.url);
  const sort = searchParams.get("sort") ?? "new";
  const safeSort = sort === "top" || sort === "old" ? sort : "new";
  const page = Math.max(0, parseInt(searchParams.get("page") ?? "0", 10) || 0);
  const size = Math.max(1, Math.min(parseInt(searchParams.get("size") ?? "20", 10) || 20, 50));
  const qs = new URLSearchParams({ sort: safeSort, page: String(page), size: String(size) });
  try {
    const data = await javaFetch<unknown>(`/community/posts/${id}/comments?${qs}`, { token });
    return NextResponse.json(data);
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed" }, { status });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await req.json();
    const data = await javaFetch<unknown>(`/community/posts/${id}/comments`, {
      method: "POST",
      body,
      token: session.accessToken,
    });
    return NextResponse.json(data);
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed" }, { status });
  }
}
