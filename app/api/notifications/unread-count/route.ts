import { NextRequest, NextResponse } from "next/server";
import { getServerAccessToken } from "@/lib/serverAuth";
import { javaFetch } from "@/lib/javaApi";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = await getServerAccessToken(req);
  if (!token) {
    return NextResponse.json({ count: 0 }, { status: 200 });
  }
  try {
    const data = await javaFetch<{ count: number }>(
      "/notifications/unread-count",
      { token: token },
    );
    return NextResponse.json(data);
  } catch {
    // Don't fail loud on the bell badge — just show 0 if the backend is cold.
    return NextResponse.json({ count: 0 }, { status: 200 });
  }
}
