import { NextRequest, NextResponse } from "next/server";
import { javaFetch } from "@/lib/javaApi";
import { isOperatorRole } from "@/lib/rbac";
import { mintSsoCode, type SsoPayload } from "@/lib/sso";

export const dynamic = "force-dynamic";

// Allow Vercel to keep the function alive long enough for a slow Java
// response (Railway / Neon cold-starts have been observed up to ~30 s).
// `javaFetch` aborts at 12 s — comfortably inside this ceiling — so we
// always return a controlled JSON error rather than Vercel killing the
// function and returning its own opaque 503.
//
// 15 s sits inside the Hobby tier's 60 s ceiling and well inside Pro.
export const maxDuration = 15;

export async function POST(req: NextRequest) {
  // Parse the body in its own guard so a malformed JSON payload returns
  // a clean 400 (client error) rather than falling through to the
  // catch-all and surfacing as a misleading 500.
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body.", code: "bad_request" },
      { status: 400 },
    );
  }

  try {
    // 12 s — slightly above our normal 10 s default to absorb Neon
    // wake-up + first-query overhead, but still inside `maxDuration`
    // so the Vercel platform never preempts us.
    const data = await javaFetch<{
      session?: { accessToken: string; refreshToken: string; expiresAt?: string };
      user?: {
        id: string;
        email: string;
        displayName: string;
        avatarUrl?: string | null;
        role: string;
      };
    }>("/auth/login", {
      method: "POST",
      body,
      timeoutMs: 12_000,
    });

    if (data.user && data.session && isOperatorRole(data.user.role)) {
      const expiresAt =
        data.session.expiresAt ?? new Date(Date.now() + 15 * 60_000).toISOString();
      const ssoCode = await mintSsoCode({
        accessToken: data.session.accessToken,
        refreshToken: data.session.refreshToken,
        user: {
          id: data.user.id,
          email: data.user.email,
          displayName: data.user.displayName,
          avatarUrl: data.user.avatarUrl ?? undefined,
          role: data.user.role,
        },
        expiresAt,
      } satisfies SsoPayload);
      return NextResponse.json({ user: data.user, ssoCode, expiresAt });
    }

    return NextResponse.json({ user: data.user });
  } catch (error) {
    const name = (error as Error).name;
    const status = (error as { status?: number }).status;
    const rawMessage = error instanceof Error ? error.message : "";
    // NEW-8 — Node's `fetch` wraps low-level connection errors (e.g.
    // ECONNREFUSED when the Java service isn't listening at all) into
    // a `TypeError: fetch failed` whose `.cause` carries the libuv code.
    // Catch those too so a totally-unreachable backend produces the
    // same friendly "warming up" 503 as a slow one, not a generic 500
    // that users misread as "wrong password".
    const cause = (error as { cause?: { code?: string } }).cause;
    const isNetworkFailure =
      name === "TypeError" &&
      typeof cause?.code === "string" &&
      [
        "ECONNREFUSED",
        "ECONNRESET",
        "ENOTFOUND",
        "EAI_AGAIN",
        "UND_ERR_SOCKET",
        "UND_ERR_CONNECT_TIMEOUT",
      ].includes(cause.code);

    // ── 1. Backend slow / aborted / unreachable ─────────────────────
    if (name === "AbortError" || name === "TimeoutError" || isNetworkFailure) {
      console.error(
        "[auth/login] Java fetch failed (timeout or network):",
        rawMessage,
        cause?.code ?? "",
      );
      return NextResponse.json(
        {
          error:
            "Sign-in service is taking longer than usual to respond. " +
            "Please wait a moment and try again.",
          code: "backend_timeout",
        },
        { status: 503 },
      );
    }

    // ── 2. Railway edge "Application not found" / DNS error ─────────
    if (status === 404) {
      console.error("[auth/login] Java returned 404 — service URL mismatch?");
      return NextResponse.json(
        {
          error: "Sign-in service is unavailable. Please try again in a moment.",
          code: "backend_not_found",
        },
        { status: 503 },
      );
    }

    // ── 3. Invalid credentials (Java rejected password) ─────────────
    if (status === 401) {
      return NextResponse.json(
        { error: "Invalid email or password.", code: "invalid_credentials" },
        { status: 401 },
      );
    }

    // ── 4. Java validation error (e.g. EMAIL_NOT_VERIFIED) ──────────
    if (status === 400) {
      // Java signals an unverified account with the stable code
      // `EMAIL_NOT_VERIFIED` (see AuthService.login). Forward a
      // normalised `email_not_verified` code so the sign-in page can
      // route the user to /verify-email deterministically instead of
      // pattern-matching the human-readable message text.
      const javaCode = (error as { code?: string }).code;
      if (javaCode === "EMAIL_NOT_VERIFIED") {
        return NextResponse.json(
          {
            error: rawMessage || "Please verify your email before signing in.",
            code: "email_not_verified",
          },
          { status: 400 },
        );
      }
      return NextResponse.json(
        {
          error: rawMessage || "Invalid request. Please check your details.",
          code: "validation_error",
        },
        { status: 400 },
      );
    }

    // ── 5. Java 5xx (most commonly: DB unreachable / pool exhausted)
    //
    // We've seen this in prod when Neon's compute scales to zero and
    // takes too long to wake, or when the HikariCP pool gets
    // exhausted. Treat as 503 because the issue is transient backend
    // health, not a client error.
    if (typeof status === "number" && status >= 500 && status < 600) {
      console.error(
        "[auth/login] Java returned",
        status,
        "—",
        rawMessage,
        "(likely DB unreachable from flood-service-community on Railway;",
        "check Neon compute status + HikariCP pool, then restart the",
        "Railway service if needed)",
      );
      return NextResponse.json(
        {
          error:
            "Sign-in service is experiencing an outage. " +
            "The team has been notified — please try again shortly.",
          code: "backend_unavailable",
        },
        { status: 503 },
      );
    }

    // ── 6. Catch-all (network failure, unknown shape) ───────────────
    console.error("[auth/login] unexpected error:", rawMessage, error);
    return NextResponse.json(
      { error: "Login failed. Please try again.", code: "unknown" },
      { status: status ?? 500 },
    );
  }
}
