import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe Auth.js config for {@link proxy.ts} — no Credentials providers,
 * no JAVA_API fetch, no JWT refresh. Full server config is in {@link ./auth.ts}.
 */
export default {
  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60, // 7 days — matches Spring Boot refresh token lifetime
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  trustHost: true,
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const path = request.nextUrl.pathname;
      const isAuthed = !!auth?.user;
      // /forgot-password and /reset-password must remain reachable even
      // while a session cookie is still active — a user may want to
      // reset their password from a code on their phone after already
      // signing in on this browser. /login also stays accessible so the
      // user can switch accounts (e.g. just changed their password in
      // settings, the JWT still validates, and they want to re-login).
      // /register is the only auth page we hard-bounce — already
      // signed-in users have no business creating a duplicate account.
      if (isAuthed && path === "/register") {
        return Response.redirect(new URL("/", request.nextUrl));
      }
      if (path.startsWith("/settings") && !isAuthed) {
        const cb = encodeURIComponent(request.nextUrl.href);
        return Response.redirect(new URL(`/login?callbackUrl=${cb}`, request.nextUrl));
      }
      return true;
    },
  },
} satisfies NextAuthConfig;
