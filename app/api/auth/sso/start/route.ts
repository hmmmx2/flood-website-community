// POST /api/auth/sso/start
//
// Mint a one-time SSO handoff code that the CRM can redeem to set
// its own httpOnly cookies. See `lib/sso.ts` for the full flow.
//
// Called by the community login form AFTER `/api/auth/login`
// returned a successful Java response. We verify the role here
// server-side (defence-in-depth: don't even mint a code for a
// Customer) before stashing the tokens in Upstash.
//
// Request body:
//   { accessToken, refreshToken, user: {...}, expiresAt }
//
// Responses:
//   200 { code: "<32 URL-safe bytes>" }
//   400 { error: "bad_request" }              — missing/malformed body
//   403 { error: "not_operator" }             — role is Customer/unknown
//   503 { error: "service_unavailable" }      — Upstash blip

import { NextRequest, NextResponse } from "next/server";
import { isOperatorRole } from "@/lib/rbac";
import { mintSsoCode, type SsoPayload } from "@/lib/sso";

/**
 * Decode the payload section of a JWT WITHOUT verifying the signature.
 * Used solely for the operator-class pre-flight gate below — the CRM
 * re-verifies signature + role during redeem with its own JWT_SECRET.
 * Returns `null` for any malformed input; never throws.
 */
function decodeJwtPayload(token: string): { role?: string } | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const decoded =
      typeof Buffer !== "undefined"
        ? Buffer.from(padded, "base64").toString("utf-8")
        : atob(padded);
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Body = Partial<SsoPayload>;

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  if (
    !body ||
    typeof body.accessToken !== "string" ||
    typeof body.refreshToken !== "string" ||
    !body.user ||
    typeof body.user !== "object" ||
    typeof (body.user as { id?: unknown }).id !== "string" ||
    typeof (body.user as { email?: unknown }).email !== "string" ||
    typeof body.expiresAt !== "string"
  ) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  // Trust ladder: we accept the tokens at face value because they
  // were just minted by Java (caller is our own login form). We do
  // peek at the JWT role for the operator-class gate — purely to
  // refuse minting a code for a Customer, which would be useless
  // (CRM's redeem would 403 anyway). No signature verification on
  // community: the CRM re-verifies during redeem with its own
  // JWT_SECRET — that's the wall against forgery.
  const payload = decodeJwtPayload(body.accessToken);
  const jwtRole = typeof payload?.role === "string" ? payload.role : null;
  if (!isOperatorRole(jwtRole)) {
    return NextResponse.json({ error: "not_operator" }, { status: 403 });
  }

  try {
    const code = await mintSsoCode(body as SsoPayload);
    return NextResponse.json({ code });
  } catch (err) {
    // Surface a precise reason in Vercel logs so a 503 in prod is
    // immediately diagnosable. The most common case is the Upstash
    // env vars being absent on `flood-website-community.vercel.app`
    // (they used to be optional for caching; the SSO flow now needs
    // them) — `getRedis()` throws "Upstash Redis env vars missing".
    const msg = err instanceof Error ? err.message : String(err);
    const upstashMissing = /Upstash.*env vars missing/i.test(msg);
    console.error(
      "[sso/start] mint failed",
      upstashMissing
        ? "→ Upstash env vars are NOT set on this deployment. Set " +
            "UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN " +
            "on the community Vercel project (Production + Preview) " +
            "and redeploy. The shared Upstash DB is the same one " +
            "the CRM project uses."
        : msg,
      err,
    );
    return NextResponse.json(
      {
        error: upstashMissing
          ? "sso_storage_unavailable"
          : "service_unavailable",
        // Hint is shown to the user via the login page's ERROR_MESSAGES
        // map, so they're not staring at a generic 503.
      },
      { status: 503 },
    );
  }
}
