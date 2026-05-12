"use client";

import { signIn } from "next-auth/react";

import { authFetch } from "@/lib/authFetch";

/** Error thrown when a community BFF route returns non-OK after parsing JSON body. */
export class CommunityRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    /** Server-supplied machine code, e.g. `RATE_LIMITED`, `DUPLICATE_COMMENT`. */
    public readonly code?: string,
    /** Seconds to wait before retrying — set by the rate limiter on 429s. */
    public readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "CommunityRequestError";
  }
}

type FailureShape = {
  error?: string;
  message?: string;
  code?: string;
  retryAfterSeconds?: number;
};

async function parseFailure(res: Response): Promise<FailureShape & { message: string }> {
  const out: FailureShape & { message: string } = {
    message: `Request failed (${res.status})`,
  };
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    try {
      const body = (await res.json()) as FailureShape;
      if (typeof body?.error === "string") out.message = body.error;
      else if (typeof body?.message === "string") out.message = body.message;
      if (typeof body?.code === "string") out.code = body.code;
      if (typeof body?.retryAfterSeconds === "number") out.retryAfterSeconds = body.retryAfterSeconds;
    } catch {
      /* keep generic */
    }
  }
  // Fall back to the Retry-After header when the body doesn't carry it.
  if (out.retryAfterSeconds == null) {
    const ra = res.headers.get("Retry-After");
    const n = ra ? Number(ra) : NaN;
    if (Number.isFinite(n) && n > 0) out.retryAfterSeconds = n;
  }
  // Friendlier default for the rate-limit case if the server only sends a status.
  if (res.status === 429 && out.message.startsWith("Request failed")) {
    const ra = out.retryAfterSeconds;
    out.message = ra
      ? `You're doing that too quickly. Try again in ${ra}s.`
      : "You're doing that too quickly. Try again in a few seconds.";
    if (!out.code) out.code = "RATE_LIMITED";
  }
  return out;
}

/** Public JSON fetch (no Authorization). Use for read-only BFF routes. */
export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, cache: "no-store" });
  const ct = res.headers.get("content-type") ?? "";

  if (!res.ok) {
    const f = await parseFailure(res);
    throw new CommunityRequestError(f.message, res.status, f.code, f.retryAfterSeconds);
  }

  if (res.status === 204) return undefined as T;
  const looksJson = ct.includes("application/json") || ct.includes("+json");
  if (!looksJson) return undefined as T;
  return res.json() as Promise<T>;
}

/**
 * Authenticated JSON fetch via {@link authFetch}. On 401/403, triggers NextAuth sign-in
 * with return URL so the user can re-authenticate after expiry.
 */
export async function authFetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await authFetch(url, init);
  const ct = res.headers.get("content-type") ?? "";

  if (res.status === 401 || res.status === 403) {
    if (typeof window !== "undefined") {
      await signIn(undefined, {
        callbackUrl: `${window.location.pathname}${window.location.search}`,
      });
    }
    throw new CommunityRequestError("Authentication required", res.status);
  }

  if (!res.ok) {
    const f = await parseFailure(res);
    throw new CommunityRequestError(f.message, res.status, f.code, f.retryAfterSeconds);
  }

  if (res.status === 204) return undefined as T;
  const looksJson = ct.includes("application/json") || ct.includes("+json");
  if (!looksJson) return undefined as T;
  return res.json() as Promise<T>;
}
