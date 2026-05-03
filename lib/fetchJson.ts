"use client";

import { signIn } from "next-auth/react";

import { authFetch } from "@/lib/authFetch";

/** Error thrown when a community BFF route returns non-OK after parsing JSON body. */
export class CommunityRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "CommunityRequestError";
  }
}

async function parseFailure(res: Response): Promise<string> {
  let message = `Request failed (${res.status})`;
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    try {
      const body = (await res.json()) as { error?: string; message?: string };
      if (typeof body?.error === "string") message = body.error;
      else if (typeof body?.message === "string") message = body.message;
    } catch {
      /* keep generic */
    }
  }
  return message;
}

/** Public JSON fetch (no Authorization). Use for read-only BFF routes. */
export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, cache: "no-store" });
  const ct = res.headers.get("content-type") ?? "";

  if (!res.ok) {
    const message = await parseFailure(res);
    throw new CommunityRequestError(message, res.status);
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
    const message = await parseFailure(res);
    throw new CommunityRequestError(message, res.status);
  }

  if (res.status === 204) return undefined as T;
  const looksJson = ct.includes("application/json") || ct.includes("+json");
  if (!looksJson) return undefined as T;
  return res.json() as Promise<T>;
}
