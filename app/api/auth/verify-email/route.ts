import { NextRequest, NextResponse } from "next/server";
import { javaFetch } from "@/lib/javaApi";

export const dynamic = "force-dynamic";
// QA NEW-4 — uniform 15 s Vercel ceiling + 12 s upstream timeout
// matches /api/auth/login. Java cold-start surfaces as 503 "warming
// up" instead of an opaque Vercel 504.
export const maxDuration = 15;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = await javaFetch<unknown>("/auth/verify-email", {
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
    if (status === 410) {
      return NextResponse.json(
        { error: "This verification code has expired. Request a new one from the sign-in page." },
        { status: 410 },
      );
    }
    if (status === 429) {
      return NextResponse.json(
        { error: "Too many attempts. Please wait before trying again." },
        { status: 429 },
      );
    }
    const message = error instanceof Error ? error.message : "Verification failed.";
    return NextResponse.json({ error: message }, { status: status ?? 500 });
  }
}
