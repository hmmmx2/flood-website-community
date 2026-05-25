import { NextRequest, NextResponse } from "next/server";
import { requireServerAccessToken } from "@/lib/serverAuth";
import { javaFetch } from "@/lib/javaApi";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const token = await requireServerAccessToken(req);
  if (token instanceof NextResponse) return token;
  try {
    const { id } = await params;
    const body = await req.json();
    const data = await javaFetch<unknown>(`/community/posts/${id}/report`, {
      method: "POST",
      body,
      token: token,
    });
    return NextResponse.json(data);
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to report" },
      { status },
    );
  }
}
