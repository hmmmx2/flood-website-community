import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Returns the CRM base URL, read from server-side env at request time.
 * The login page fetches this before redirecting admins — avoids baking
 * the URL into the JS bundle via NEXT_PUBLIC_ (which requires a rebuild to update).
 */
export function GET() {
  const url =
    process.env.CRM_URL ||
    process.env.NEXT_PUBLIC_CRM_URL ||
    "http://localhost:3000";
  return NextResponse.json({ url });
}
