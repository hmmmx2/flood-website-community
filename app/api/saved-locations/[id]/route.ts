import { NextRequest, NextResponse } from "next/server";
import { requireServerAccessToken } from "@/lib/serverAuth";
import { javaFetch } from "@/lib/javaApi";

export const dynamic = "force-dynamic";

/**
 * PATCH  /api/saved-locations/[id]  → update label / lat / lng / radius
 * DELETE /api/saved-locations/[id]  → remove pin
 *
 * Ownership is enforced server-side by SavedLocationService — a user
 * can only mutate their own pins; cross-user PATCH / DELETE attempts
 * return 403.
 */

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const token = await requireServerAccessToken(req);
  if (token instanceof NextResponse) return token;
  try {
    const { id } = await params;
    const body = await req.json();
    const data = await javaFetch<unknown>(`/saved-locations/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body,
      token: token,
    });
    return NextResponse.json(data);
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status },
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const token = await requireServerAccessToken(req);
  if (token instanceof NextResponse) return token;
  try {
    const { id } = await params;
    await javaFetch<unknown>(`/saved-locations/${encodeURIComponent(id)}`, {
      method: "DELETE",
      token: token,
    });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status },
    );
  }
}
