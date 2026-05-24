// flood-service-community — default port 4001 (application.yml SERVER_PORT)
// Server-side only — never import in client components.

import { normaliseJavaApiBase } from "@/lib/normaliseJavaApiBase";

const JAVA_API = normaliseJavaApiBase(
  process.env.JAVA_API_URL,
  "http://localhost:4001",
);

/** Exposed for routes that proxy long-lived streams (SSE) and need to
 *  build the upstream URL themselves rather than going through fetch JSON. */
export const JAVA_API_BASE = JAVA_API;

type Opts = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  token?: string;
  /**
   * Extra request headers. Used (e.g.) by the public flood-map route
   * to send the `X-Internal-Key` service secret to the Java backend
   * without crossing the browser. Values here win over the defaults.
   */
  headers?: Record<string, string>;
  /** Next.js ISR revalidation window in seconds. 0 = no-store (default for auth/mutation routes). */
  revalidate?: number;
  /** Hard timeout in ms. Defaults to 10 s — prevents hanging on Railway cold starts. */
  timeoutMs?: number;
};

export async function javaFetch<T>(path: string, opts: Opts = {}): Promise<T> {
  const {
    method = "GET",
    body,
    token,
    headers: extraHeaders,
    revalidate = 0,
    timeoutMs = 10_000,
  } = opts;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (extraHeaders) Object.assign(headers, extraHeaders);

  const p = path.startsWith("/") ? path : `/${path}`;
  const res = await fetch(`${JAVA_API}${p}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    next: { revalidate },
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (res.status === 204) return undefined as unknown as T;

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    // Try to extract a human-readable message AND the machine-readable
    // error code from the JSON body. The Java GlobalExceptionHandler
    // returns { code: "...", message: "..." } (and some routes use
    // { error: "..." }). Callers that need to branch on the specific
    // failure (e.g. EMAIL_NOT_VERIFIED) read `err.code` rather than
    // regex-matching the human message, which is wording-fragile.
    let parsedMessage: string | undefined;
    let parsedCode: string | undefined;
    try {
      const json = JSON.parse(text);
      parsedMessage = json.message || json.error;
      if (typeof json.code === "string") parsedCode = json.code;
    } catch {
      /* not JSON — use raw text */
    }

    const err = new Error(parsedMessage || `${method} ${p} → ${res.status}`) as Error & {
      status: number;
      code?: string;
      rawBody: string;
    };
    err.status = res.status;
    err.code = parsedCode;
    err.rawBody = text;
    throw err;
  }

  return res.json() as Promise<T>;
}

export function extractToken(authHeader: string | null): string | undefined {
  return authHeader?.replace(/^Bearer\s+/i, "") ?? undefined;
}
