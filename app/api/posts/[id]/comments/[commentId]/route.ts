import { NextRequest, NextResponse } from "next/server";
import { javaFetch, extractToken } from "@/lib/javaApi";

export const dynamic = "force-dynamic";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  const { id, commentId } = await params;
  try {
    const token = extractToken(req.headers.get("authorization"));
    await javaFetch<void>(`/community/posts/${id}/comments/${commentId}`, { method: "DELETE", token });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed" }, { status });
  }
}
