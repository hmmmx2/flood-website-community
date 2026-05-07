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
      // Authenticated users have no business on the public auth pages —
      // bounce them home so they can't accidentally re-trigger reset flows
      // for themselves or look at stale "create account" forms.
      if (
        isAuthed &&
        (path === "/login" ||
          path === "/register" ||
          path === "/forgot-password" ||
          path === "/reset-password")
      ) {
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
