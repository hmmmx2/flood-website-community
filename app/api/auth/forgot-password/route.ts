import { NextRequest, NextResponse } from "next/server";
import { javaFetch } from "@/lib/javaApi";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    await javaFetch<unknown>("/auth/forgot-password", { method: "POST", body });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const name   = (error as Error).name;
    const status = (error as { status?: number }).status;

    if (name === "AbortError" || name === "TimeoutError") {
      return NextResponse.json(
        { error: "The server is warming up. Please wait a moment and try again." },
        { status: 503 }
      );
    }

    // Railway "Application not found" — service down or URL mismatch
    if (status === 404) {
      return NextResponse.json(
        { error: "Service temporarily unavailable. Please try again in a moment." },
        { status: 503 }
      );
    }

    // Spring Boot returns 404 if email doesn't exist — surface that cleanly
    if (status === 400) {
      const msg = error instanceof Error ? error.message : null;
      return NextResponse.json(
        { error: msg || "Could not send reset code. Please check the email address." },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to send reset code. Please try again." },
      { status: status ?? 500 }
    );
  }
}
