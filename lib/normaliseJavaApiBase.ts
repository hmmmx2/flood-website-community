/**
 * Normalises the Spring / Kong base URL used by server-side `fetch` to Java.
 *
 * - Adds `https://` when the env value has no scheme (common for Vercel variables).
 * - Strips trailing slashes so `${base}${path}` never produces `//` before the path.
 *
 * **BFF vs Kong:** The Next.js layer (`/api/*`, NextAuth) is the BFF — same-origin
 * for the browser, session cookies, and hiding backend URLs. Kong is the **internal**
 * gateway in Docker (`deploy/docker-compose.yml`): set `JAVA_API_URL` to
 * `http://kong-gateway:8000/community` so server-side calls match production routing.
 * On Vercel + Railway, point `JAVA_API_URL` at the Spring URL directly (no Kong).
 */
export function normaliseJavaApiBase(
  raw: string | undefined,
  fallback: string,
): string {
  let u = (raw ?? "").trim() || fallback;
  if (u && !u.startsWith("http://") && !u.startsWith("https://")) {
    u = `https://${u}`;
  }
  return u.replace(/\/+$/, "");
}
