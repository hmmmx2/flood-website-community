// ──────────────────────────────────────────────────────────────────────
// lib/sso.ts — SSO handoff helpers (community side)
//
// The browser-facing SSO redirect goes through an opaque short-lived
// code instead of putting tokens in the URL. Tokens travel via the
// shared Upstash Redis (both Vercel apps reach the same DB).
//
// Flow (operator-class login):
//   1. Community /api/auth/login succeeds against Java.
//   2. /api/auth/sso/start calls `mintSsoCode(payload)` here:
//        - Generates 32 random URL-safe bytes (the "code")
//        - Stores the token bundle under `sso:<code>` with 60s TTL
//        - Returns the code.
//   3. Community redirects browser to ${CRM_URL}/auth/callback?code=<code>
//   4. CRM `/auth/callback` calls its sibling `redeemSsoCode(code)`
//      (atomic GETDEL via Upstash), re-verifies role, sets cookies.
//
// The URL the browser ever sees contains only the opaque code —
// tokens never appear in browser history, server logs, or referrers.
// Codes are single-use (GETDEL on redeem) AND expire after 60s.
// ──────────────────────────────────────────────────────────────────────

import { randomBytes } from "node:crypto";
import { getRedis } from "@/lib/redis";

/** The bundle stashed in Upstash and handed off to the CRM. */
export type SsoPayload = {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    displayName: string;
    avatarUrl?: string;
    role: string;
  };
  /** ISO-8601 access-token expiry (from Java). */
  expiresAt: string;
};

const KEY_PREFIX = "sso:";
const TTL_SECONDS = 60;

/**
 * Mint a new SSO code and stash the payload in Upstash. The code is
 * 32 random bytes encoded as URL-safe base64 (43 chars). The Upstash
 * key uses `set ... nx` so a freakishly-unlikely collision can't
 * silently overwrite an existing handoff in flight.
 */
export async function mintSsoCode(payload: SsoPayload): Promise<string> {
  const code = randomBytes(32).toString("base64url");
  const redis = getRedis();
  // `nx: true` makes the set fail if the key already exists. The
  // chance is astronomically low (32B random) — this is just belt &
  // braces against a faulty RNG.
  const result = await redis.set(KEY_PREFIX + code, JSON.stringify(payload), {
    ex: TTL_SECONDS,
    nx: true,
  });
  if (result !== "OK") {
    // Try once more with a fresh code.
    return mintSsoCode(payload);
  }
  return code;
}
