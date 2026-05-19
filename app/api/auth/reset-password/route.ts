import { NextRequest, NextResponse } from "next/server";
import { javaFetch } from "@/lib/javaApi";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    await javaFetch<unknown>("/auth/reset-password", {
      method: "POST",
      body,
      timeoutMs: 12_000,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const name = (error as Error).name;
    const status = (error as { status?: number }).status;
    if (name === "AbortError" || name === "TimeoutError") {
      return NextResponse.json(
        { error: "The server is warming up. Please wait a moment and try again." },
        { status: 503 },
      );
    }
    // Java returns 410 for expired / already-redeemed reset codes.
    if (status === 410) {
      return NextResponse.json(
        {
          error:
            "This reset code has expired or has already been used. Request a new one from the forgot-password page.",
        },
        { status: 410 },
      );
    }
    if (status === 400) {
      const msg = error instanceof Error ? error.message : null;
      return NextResponse.json(
        { error: msg || "Could not reset the password. Please check your inputs." },
        { status: 400 },
      );
    }
    if (status === 429) {
      return NextResponse.json(
        { error: "Too many attempts. Please wait before trying again." },
        { status: 429 },
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to reset password." },
      { status: status ?? 500 },
    );
  }
}
