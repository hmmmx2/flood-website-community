import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { nextUrl } = req;
  const isAuthenticated = !!req.auth?.user;
  const path = nextUrl.pathname;

  // Redirect already-authenticated users away from auth pages
  if ((path === "/login" || path === "/register") && isAuthenticated) {
    return NextResponse.redirect(new URL("/", nextUrl));
  }

  // Settings page requires authentication
  if (path.startsWith("/settings") && !isAuthenticated) {
    const callbackUrl = encodeURIComponent(nextUrl.href);
    return NextResponse.redirect(
      new URL(`/login?callbackUrl=${callbackUrl}`, nextUrl),
    );
  }

  return NextResponse.next();
});

export const config = {
  // Run on all routes except Next.js internals, static files, and images
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|images/).*)",
  ],
};
