"use client";

import { getSession } from "next-auth/react";

/**
 * Authenticated fetch wrapper for client components.
 *
 * Retrieves the current NextAuth session before each call — the session JWT
 * callback automatically refreshes the Spring Boot access token when it
 * expires, so `getSession()` always yields a valid token when the session
 * is healthy.
 */
export async function authFetch(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  const session = await getSession();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  if (session?.accessToken) {
    headers["Authorization"] = `Bearer ${session.accessToken}`;
  }
  return fetch(url, { ...options, headers });
}
