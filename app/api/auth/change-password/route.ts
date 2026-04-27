import { NextRequest, NextResponse } from "next/server";
import { javaFetch, extractToken } from "@/lib/javaApi";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const token = extractToken(req.headers.get("authorization"));
    const body = await req.json();
    const data = await javaFetch<unknown>("/auth/change-password", { method: "POST", body, token });
    return NextResponse.json(data);
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed" }, { status });
  }
}
