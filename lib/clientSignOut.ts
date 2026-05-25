"use client";

import { signOut } from "next-auth/react";

/**
 * Deterministic client sign-out.
 *
 * Calls NextAuth `signOut({ redirect: false })` so the POST to
 * /api/auth/signout — which clears the httpOnly session cookie(s)
 * server-side — completes BEFORE we navigate, then performs a HARD
 * navigation via `location.replace`.
 *
 * Why `replace` + hard navigation (not signOut's built-in redirect):
 *   • A full document load guarantees the destination is rendered fresh
 *     and can't be served from the back-forward cache (bfcache) with a
 *     stale, still-logged-in JS heap.
 *   • `replace` keeps the just-cleared page out of forward history, so
 *     a forward/back press can't restore the logged-in view.
 */
export async function clientSignOut(callbackUrl = "/login"): Promise<void> {
  try {
    await signOut({ redirect: false });
  } finally {
    if (typeof window !== "undefined") {
      window.location.replace(callbackUrl);
    }
  }
}
