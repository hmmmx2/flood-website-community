"use client";

/**
 * Authenticated fetch wrapper for client components.
 *
 * Client components call same-origin BFF routes. Backend bearer tokens stay
 * server-side in NextAuth route handlers instead of being copied into browser
 * request headers.
 */
export async function authFetch(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  const method = (options.method ?? "GET").toUpperCase();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    const csrf = (await fetch("/api/auth/csrf", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)) as { csrfToken?: string } | null;
    if (csrf?.csrfToken) headers["X-CSRF-Token"] = csrf.csrfToken;
  }

  return fetch(url, { ...options, headers, credentials: "same-origin" });
}
