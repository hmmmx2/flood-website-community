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
