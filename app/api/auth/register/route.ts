import { NextRequest, NextResponse } from "next/server";
import { javaFetch } from "@/lib/javaApi";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = await javaFetch<unknown>("/auth/register", { method: "POST", body });
    return NextResponse.json(data);
  } catch (error) {
    const name   = (error as Error).name;
    const status = (error as { status?: number }).status;

    if (name === "AbortError" || name === "TimeoutError") {
      return NextResponse.json(
        { error: "The server is warming up. Please wait a moment and try again." },
        { status: 503 }
      );
    }

    if (status === 404) {
      return NextResponse.json(
        { error: "Service temporarily unavailable. Please try again in a moment." },
        { status: 503 }
      );
    }

    if (status === 409) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 }
      );
    }

    if (status === 400) {
      const msg = error instanceof Error ? error.message : null;
      return NextResponse.json(
        { error: msg || "Please check your details and try again." },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Registration failed. Please try again." },
      { status: status ?? 500 }
    );
  }
}
