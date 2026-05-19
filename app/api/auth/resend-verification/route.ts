import { NextRequest, NextResponse } from "next/server";
import { javaFetch } from "@/lib/javaApi";

export const dynamic = "force-dynamic";
// QA NEW-4 — uniform timeout strategy with the rest of /api/auth/*.
export const maxDuration = 15;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = await javaFetch<unknown>("/auth/resend-verification", {
      method: "POST",
      body,
      timeoutMs: 12_000,
    });
    return NextResponse.json(data);
  } catch (error) {
    const name = (error as Error).name;
    const status = (error as { status?: number }).status;
    if (name === "AbortError" || name === "TimeoutError") {
      return NextResponse.json(
        { error: "The server is warming up. Please wait a moment and try again." },
        { status: 503 },
      );
    }
    if (status === 429) {
      // Java's resend-cooldown — return a friendlier message than a
      // raw "Too Many Requests" so the user knows to wait, not retry.
      return NextResponse.json(
        {
          error:
            "You've requested a code recently. Please wait a minute before requesting another.",
        },
        { status: 429 },
      );
    }
    const message = error instanceof Error ? error.message : "Resend failed.";
    return NextResponse.json({ error: message }, { status: status ?? 500 });
  }
}
