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

  webpack(config) {
    if (process.env.VERCEL) {
      config.cache = { type: "memory" };
    }
    return config;
  },
};

export default nextConfig;
