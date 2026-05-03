import { NextResponse } from "next/server";
import { javaFetch } from "@/lib/javaApi";

export const dynamic = "force-dynamic";

/**
 * Public sensor list — Java GET /sensors is permitAll; no session required.
 * (Avoids coupling this route to auth() so the map always receives data when the API is up.)
 */
export async function GET() {
  try {
    const data = await javaFetch<unknown>("/sensors");
    return NextResponse.json(data);
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed" }, { status });
  }
}
