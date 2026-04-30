// flood-service-community — default port 4001 (application.yml SERVER_PORT)
// Server-side only — never import in client components.

// Normalise the URL: if the env var was set without a protocol (e.g. in
// Vercel's dashboard without "https://"), prefix it automatically so that
// Node.js fetch does not throw "Failed to parse URL".
function normaliseUrl(raw: string): string {
  if (!raw || raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  return `https://${raw}`;
}

const JAVA_API = normaliseUrl(process.env.JAVA_API_URL || "http://localhost:4001");

type Opts = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  token?: string;
  /** Next.js ISR revalidation window in seconds. 0 = no-store (default for auth/mutation routes). */
  revalidate?: number;
  /** Hard timeout in ms. Defaults to 10 s — prevents hanging on Railway cold starts. */
  timeoutMs?: number;
};

export async function javaFetch<T>(path: string, opts: Opts = {}): Promise<T> {
  const { method = "GET", body, token, revalidate = 0, timeoutMs = 10_000 } = opts;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${JAVA_API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    next: { revalidate },
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (res.status === 204) return undefined as unknown as T;

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    // Try to extract a human-readable message from the JSON body.
    // Spring Boot returns { message: "..." } or { error: "..." }.
    let parsed: string | undefined;
    try {
      const json = JSON.parse(text);
      parsed = json.message || json.error;
    } catch { /* not JSON — use raw text */ }

    const err = new Error(parsed || `${method} ${path} → ${res.status}`) as Error & {
      status: number;
      rawBody: string;
    };
    err.status = res.status;
    err.rawBody = text;
    throw err;
  }

  return res.json() as Promise<T>;
}

export function extractToken(authHeader: string | null): string | undefined {
  return authHeader?.replace(/^Bearer\s+/i, "") ?? undefined;
}
