import { NextRequest, NextResponse } from "next/server";
import { javaFetch } from "@/lib/javaApi";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = await javaFetch<unknown>("/auth/login", { method: "POST", body });
    return NextResponse.json(data);
  } catch (error) {
    const name   = (error as Error).name;
    const status = (error as { status?: number }).status;

    // Backend cold-starting on Railway (Neon DB warm-up can take 30-60 s)
    if (name === "AbortError" || name === "TimeoutError") {
      return NextResponse.json(
        { error: "The server is warming up. Please wait a moment and try again." },
        { status: 503 }
      );
    }

    // Railway gateway "Application not found" — service not yet deployed or URL mismatch
    if (status === 404) {
      return NextResponse.json(
        { error: "Service temporarily unavailable. Please try again in a moment." },
        { status: 503 }
      );
    }

    if (status === 401) {
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 }
      );
    }

    // Pass through Spring Boot validation / business-rule messages (400)
    if (status === 400) {
      const msg = error instanceof Error ? error.message : null;
      return NextResponse.json(
        { error: msg || "Invalid request. Please check your details." },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Login failed. Please try again." },
      { status: status ?? 500 }
    );
  }
}
