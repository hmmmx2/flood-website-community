const JAVA_API = process.env.JAVA_API_URL || "http://localhost:3001";

type Opts = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  token?: string;
};

export async function javaFetch<T>(path: string, opts: Opts = {}): Promise<T> {
  const { method = "GET", body, token } = opts;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${JAVA_API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  if (res.status === 204) return undefined as unknown as T;

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err = new Error(`${method} ${path} → ${res.status}: ${text}`) as Error & { status: number };
    err.status = res.status;
    throw err;
  }

  return res.json() as Promise<T>;
}

export function extractToken(authHeader: string | null): string | undefined {
  return authHeader?.replace(/^Bearer\s+/i, "") ?? undefined;
}
