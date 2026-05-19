import type { NextConfig } from "next";

// `output: "standalone"` is required for Docker (copies only runtime files).
// Vercel sets VERCEL=1 and manages its own output format — standalone must be off there.
//
// On Vercel, use webpack memory cache only: avoids flaky restored filesystem cache
// across deploys without the heavier fully-cold `cache: false` compile path.
const nextConfig: NextConfig = {
  output: process.env.VERCEL ? undefined : "standalone",

  // Silence Turbopack warning — empty config means "use Turbopack with defaults"
  turbopack: {},

  // Local preview tooling (Claude Code preview MCP, some IDE proxies) hits
  // the dev server on 127.0.0.1 rather than `localhost`. Next 16's default
  // cross-origin guard blocks HMR/RSC traffic from those hosts and silently
  // breaks client hydration. Allow the loopback variants explicitly in dev.
  allowedDevOrigins: ["127.0.0.1", "localhost"],

  async redirects() {
    return [{ source: "/sensors", destination: "/flood-map", permanent: true }];
  },

  // QA P1-11 — Baseline security headers applied to every response.
  //
  // - HSTS:               force HTTPS in browsers that have visited before.
  //                       1-year max-age, `includeSubDomains`, `preload`.
  // - X-Content-Type-Options: nosniff — stops the browser from MIME-sniffing
  //                       text/* responses into executable scripts.
  // - X-Frame-Options:    DENY — disallows being iframed by any origin
  //                       (CSP `frame-ancestors` is the modern equivalent and
  //                       is set below; X-Frame-Options is the legacy fallback).
  // - Referrer-Policy:    strict-origin-when-cross-origin — never send the
  //                       full path on cross-origin links; only the origin.
  // - Permissions-Policy: deny camera/microphone/geolocation by default. The
  //                       flood-map opts in to geolocation via the Permissions
  //                       API at runtime, which the spec permits even when the
  //                       header lists it as `()`.
  // - Cross-Origin-Opener-Policy: same-origin — keeps popups isolated.
  // - CSP:                NOT set globally yet. The community site embeds
  //                       Google Maps, Next.js inline scripts, NextAuth, etc.;
  //                       a too-strict CSP breaks them. A follow-up sprint
  //                       should iterate a CSP via Report-Only mode.
  async headers() {
    const securityHeaders = [
      {
        key: "Strict-Transport-Security",
        value: "max-age=31536000; includeSubDomains; preload",
      },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=(self), interest-cohort=()",
      },
      { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    ];
    return [{ source: "/:path*", headers: securityHeaders }];
  },

  webpack(config) {
    if (process.env.VERCEL) {
      config.cache = { type: "memory" };
    }
    return config;
  },
};

export default nextConfig;
