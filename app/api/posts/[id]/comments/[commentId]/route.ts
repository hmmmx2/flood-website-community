import { NextRequest, NextResponse } from "next/server";
import { requireServerAccessToken } from "@/lib/serverAuth";
import { javaFetch } from "@/lib/javaApi";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> },
) {
  const { id, commentId } = await params;
  const token = await requireServerAccessToken(req);
  if (token instanceof NextResponse) return token;
  try {
    const body = await req.json();
    const data = await javaFetch<unknown>(`/community/posts/${id}/comments/${commentId}`, {
      method: "PATCH",
      body,
      token: token,
    });
    return NextResponse.json(data);
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed" }, { status });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> },
) {
  const { id, commentId } = await params;
  const token = await requireServerAccessToken(req);
  if (token instanceof NextResponse) return token;
  try {
    await javaFetch<void>(`/community/posts/${id}/comments/${commentId}`, { method: "DELETE", token: token });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed" }, { status });
  }
}
