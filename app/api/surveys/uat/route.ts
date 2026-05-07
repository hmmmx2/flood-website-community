import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { javaFetch } from "@/lib/javaApi";

export const dynamic = "force-dynamic";

/**
 * POST /api/surveys/uat — community-side UAT feedback proxy.
 *
 * Forwards the survey payload to the Java backend's /surveys/uat endpoint
 * with the user's access token attached. The same payload shape is used by
 * the CRM's mirror route, so all responses land in one Postgres table.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await req.json();
    const data = await javaFetch<unknown>("/surveys/uat", {
      method: "POST",
      body,
      token: session.accessToken,
    });
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status },
    );
  }
}
