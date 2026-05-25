import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import authConfig from "./auth.config";

import { normaliseJavaApiBase } from "@/lib/normaliseJavaApiBase";
import { isOperatorRole } from "@/lib/rbac";

const JAVA_API = normaliseJavaApiBase(
  process.env.JAVA_API_URL,
  "http://localhost:4001",
);
const ACCESS_TOKEN_MS = 15 * 60 * 1000; // 15 min — matches Spring Boot access token expiry
// After a TRANSIENT refresh failure (Railway cold start / brief 5xx /
// network blip) we keep the session alive and re-attempt the refresh
// after this delay instead of hard-logging the user out. This is what
// stops the "kicked back to login every ~15 minutes" annoyance: the
// access token refreshes every 15 min, and without this a single
// backend hiccup during that refresh ended the whole session.
const TRANSIENT_REFRESH_RETRY_MS = 60 * 1000; // re-try refresh in ~1 min

/** Used by Credentials authorize(); never throw at module load (that breaks Vercel build). */
const AUTH_SECRET = process.env.AUTH_SECRET;

if (process.env.NODE_ENV === "production" && !AUTH_SECRET) {
  throw new Error(
    "[auth] AUTH_SECRET is not set. Add it to Vercel → Settings → Environment Variables (all scopes) and redeploy.",
  );
}

/**
 * Exchange the refresh token for a fresh access token.
 *
 * Resilience (the fix for "logged out too often"): the previous version
 * treated ANY failure — including a transient Railway cold start or a
 * one-off network blip — as a terminal session error, which forced a
 * re-login roughly every 15 minutes of idle-then-active use. Now we:
 *
 *   • give each attempt a hard timeout (a hung fetch no longer stalls
 *     the whole NextAuth session callback indefinitely),
 *   • retry a few times with short backoff to ride out a cold start,
 *   • distinguish a genuine 4xx (refresh token revoked / expired — the
 *     session really is over → force re-login) from transient 5xx /
 *     network errors (keep the session, re-attempt shortly).
 *
 * The Spring Boot `/auth/refresh` does NOT rotate the refresh token, so
 * retrying with the same token is safe — there's no rotation race.
 */
async function refreshAccessToken(token: Record<string, unknown>) {
  const refreshToken = token.refreshToken as string | undefined;
  if (!refreshToken) {
    return { ...token, error: "RefreshAccessTokenError" as const };
  }

  // Up to 3 attempts (~0s, 1s, 3s backoff). Each call is capped at 7s so
  // a stuck backend can't hang the session callback forever.
  const RETRY_DELAYS_MS = [0, 1000, 3000];
  let terminalReject = false;

  for (const delay of RETRY_DELAYS_MS) {
    if (delay) await new Promise((r) => setTimeout(r, delay));
    try {
      const res = await fetch(`${JAVA_API}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
        signal: AbortSignal.timeout(7_000),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          accessToken: string;
          refreshToken?: string;
        };
        return {
          ...token,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken ?? refreshToken,
          accessTokenExpires: Date.now() + ACCESS_TOKEN_MS,
          error: undefined,
        };
      }
      // 4xx — the refresh token is invalid / revoked / expired. This is a
      // real end-of-session; stop retrying and force re-login.
      if (res.status >= 400 && res.status < 500) {
        terminalReject = true;
        break;
      }
      // 5xx — backend is up but unhappy (cold start, transient). Retry.
    } catch {
      // Network error / timeout / abort — treat as transient. Retry.
    }
  }

  if (terminalReject) {
    return { ...token, error: "RefreshAccessTokenError" as const };
  }

  // All retries exhausted on TRANSIENT failures: do NOT end the session.
  // Keep the token and re-attempt the refresh on the next session read
  // after a short delay, so a brief backend outage doesn't log the user
  // out. The next successful refresh clears this and resumes normally.
  return {
    ...token,
    accessTokenExpires: Date.now() + TRANSIENT_REFRESH_RETRY_MS,
    error: undefined,
  };
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  secret: AUTH_SECRET,
  providers: [
    Credentials({
      id: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!AUTH_SECRET) return null;
        if (!credentials?.email || !credentials?.password) return null;
        try {
          const res = await fetch(`${JAVA_API}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: credentials.email,
              password: credentials.password,
            }),
            signal: AbortSignal.timeout(15_000),
          });
          if (!res.ok) return null;
          const { session: tokens, user } = (await res.json()) as {
            session: { accessToken: string; refreshToken: string };
            user: {
              id: string;
              email: string;
              displayName: string;
              avatarUrl?: string;
              role: string;
            };
          };
          // QA P1-2 — refuse to mint a community NextAuth session for
          // any operator-class account (Admin / Operations Manager /
          // Field Technician / NGO Volunteer / Viewer). The previous
          // check only blocked "admin"; the other operator roles
          // walked past it and ended up with both a CRM session AND
          // a community session, which is the exact race the SSO
          // handoff was built to prevent. Uses the canonical RBAC
          // predicate so this stays in lockstep with the CRM gates.
          if (isOperatorRole(user.role)) return null;
          return {
            id: user.id,
            email: user.email,
            name: user.displayName,
            image: user.avatarUrl ?? null,
            role: user.role,
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            accessTokenExpires: Date.now() + ACCESS_TOKEN_MS,
          };
        } catch {
          return null;
        }
      },
    }),

    Credentials({
      id: "admin-token",
      credentials: {
        accessToken: {},
        refreshToken: {},
      },
      async authorize(credentials) {
        if (!AUTH_SECRET) return null;
        if (!credentials?.accessToken) return null;
        try {
          const res = await fetch(`${JAVA_API}/profile`, {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${credentials.accessToken}`,
            },
            signal: AbortSignal.timeout(10_000),
          });
          if (!res.ok) return null;
          const user = (await res.json()) as {
            id: string;
            email: string;
            displayName: string;
            avatarUrl?: string;
            role: string;
          };
          // QA P1-2 — same operator-class gate as the credentials
          // provider above; the admin-token provider is a back door
          // we mustn't leave wider than the front door.
          if (isOperatorRole(user.role)) return null;
          return {
            id: user.id,
            email: user.email,
            name: user.displayName,
            image: user.avatarUrl ?? null,
            role: user.role,
            accessToken: credentials.accessToken as string,
            refreshToken: (credentials.refreshToken as string) ?? "",
            accessTokenExpires: Date.now() + ACCESS_TOKEN_MS,
          };
        } catch {
          return null;
        }
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user, trigger, session }) {
      if (trigger === "update" && session?.user) {
        if (session.user.name !== undefined) token.name = session.user.name;
        if (session.user.image !== undefined) token.picture = session.user.image;
      }

      if (user) {
        return {
          ...token,
          role: (user as unknown as { role: string }).role,
          accessToken: (user as unknown as { accessToken: string }).accessToken,
          refreshToken: (user as unknown as { refreshToken: string }).refreshToken,
          accessTokenExpires: (user as unknown as { accessTokenExpires: number })
            .accessTokenExpires,
        };
      }

      const expires = token.accessTokenExpires as number | undefined;
      if (
        expires != null &&
        typeof expires === "number" &&
        !Number.isNaN(expires) &&
        Date.now() < expires
      ) {
        return token;
      }

      return refreshAccessToken(token);
    },

    async session({ session, token }) {
      const baseUser = session.user ?? { name: null, email: null, image: null };
      return {
        ...session,
        user: {
          ...baseUser,
          id: (token.sub ?? "") as string,
          role: (token.role ?? "") as string,
        },
        accessToken: (token.accessToken as string | undefined) ?? "",
        refreshToken: (token.refreshToken as string | undefined) ?? "",
        error: token.error as string | undefined,
      };
    },
  },
});
