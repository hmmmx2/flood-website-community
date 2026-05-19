import { NextRequest, NextResponse } from "next/server";
import { javaFetch } from "@/lib/javaApi";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    await javaFetch<unknown>("/auth/verify-reset-code", {
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
    if (status === 410) {
      return NextResponse.json(
        { error: "This reset code has expired. Request a new one from the forgot-password page." },
        { status: 410 },
      );
    }
    if (status === 400) {
      const msg = error instanceof Error ? error.message : null;
      return NextResponse.json(
        { error: msg || "Invalid code. Please check the digits and try again." },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Verification failed." },
      { status: status ?? 500 },
    );
  }
}
