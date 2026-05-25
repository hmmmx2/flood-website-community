import { NextRequest, NextResponse } from "next/server";
import { requireServerAccessToken } from "@/lib/serverAuth";
import { javaFetch } from "@/lib/javaApi";

export const dynamic = "force-dynamic";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ nodeId: string }> },
) {
  const token = await requireServerAccessToken(req);
  if (token instanceof NextResponse) return token;
  try {
    const { nodeId } = await params;
    await javaFetch<unknown>(`/favourites/${nodeId}`, { method: "DELETE", token: token });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed" }, { status });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ nodeId: string }> },
) {
  const token = await requireServerAccessToken(req);
  if (token instanceof NextResponse) return token;
  try {
    const { nodeId } = await params;
    const body = await req.json();
    const data = await javaFetch<unknown>(`/favourites/${nodeId}`, {
      method: "PATCH",
      token: token,
      body,
    });
    return NextResponse.json(data);
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed" }, { status });
  }
}
