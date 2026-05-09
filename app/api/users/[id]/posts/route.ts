import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { javaFetch } from "@/lib/javaApi";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const token = session?.accessToken;
  const { searchParams } = new URL(req.url);
  const page = Math.max(0, parseInt(searchParams.get("page") ?? "0", 10) || 0);
  const size = Math.max(1, Math.min(parseInt(searchParams.get("size") ?? "20", 10) || 20, 50));
  const qs = new URLSearchParams({ page: String(page), size: String(size) });
  try {
    const data = await javaFetch<unknown>(`/community/users/${id}/posts?${qs}`, { token });
    return NextResponse.json(data);
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status },
    );
  }
}
