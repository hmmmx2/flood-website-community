import { NextRequest, NextResponse } from "next/server";
import { javaFetch, extractToken } from "@/lib/javaApi";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const token = extractToken(req.headers.get("authorization"));
    const data = await javaFetch<unknown>(`/community/posts/${id}/like`, { method: "POST", token });
    return NextResponse.json(data);
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed" }, { status });
  }
}
