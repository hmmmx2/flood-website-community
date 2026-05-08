import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { javaFetch } from "@/lib/javaApi";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ count: 0 }, { status: 200 });
  }
  try {
    const data = await javaFetch<{ count: number }>(
      "/notifications/unread-count",
      { token: session.accessToken },
    );
    return NextResponse.json(data);
  } catch {
    // Don't fail loud on the bell badge — just show 0 if the backend is cold.
    return NextResponse.json({ count: 0 }, { status: 200 });
  }
}
