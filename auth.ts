import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import type { NextAuthConfig } from "next-auth";

function normaliseUrl(raw: string): string {
  if (!raw || raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  return `https://${raw}`;
}

const JAVA_API = normaliseUrl(process.env.JAVA_API_URL ?? "http://localhost:4001");
const ACCESS_TOKEN_MS = 15 * 60 * 1000; // 15 min — matches Spring Boot access token expiry

export const config: NextAuthConfig = {
  // Required in production (Vercel). Without it JWT/session routes return 500.
  secret: process.env.AUTH_SECRET,

  providers: [
    // Standard email/password login via Spring Boot
    Credentials({
      id: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
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

    // Admin cross-app SSO — validates a pre-existing Spring Boot token via /profile
    Credentials({
      id: "admin-token",
      credentials: {
        accessToken: {},
        refreshToken: {},
      },
      async authorize(credentials) {
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
    async jwt({ token, user, trigger, session }) {
      // Profile update from settings page
      if (trigger === "update" && session?.user) {
        if (session.user.name !== undefined) token.name = session.user.name;
        if (session.user.image !== undefined) token.picture = session.user.image;
      }

      // Initial sign-in — attach Spring Boot tokens to the NextAuth JWT
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

      // Return existing token if the access token has not yet expired
      const expires = token.accessTokenExpires as number | undefined;
      if (
        expires != null &&
        typeof expires === "number" &&
        !Number.isNaN(expires) &&
        Date.now() < expires
      ) {
        return token;
      }

      // Access token expired — attempt a silent refresh
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

  pages: {
    signIn: "/login",
    error: "/login",
  },

  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60, // 7 days — matches Spring Boot refresh token lifetime
  },

  trustHost: true,
};

async function refreshAccessToken(token: Record<string, unknown>) {
  try {
    const res = await fetch(`${JAVA_API}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: token.refreshToken }),
    });
    if (!res.ok) throw new Error("Refresh failed");
    const data = (await res.json()) as {
      accessToken: string;
      refreshToken?: string;
    };
    return {
      ...token,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken ?? token.refreshToken,
      accessTokenExpires: Date.now() + ACCESS_TOKEN_MS,
      error: undefined,
    };
  } catch {
    return { ...token, error: "RefreshAccessTokenError" as const };
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth(config);
