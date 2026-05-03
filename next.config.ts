import type { NextConfig } from "next";

// `output: "standalone"` is required for Docker (copies only runtime files).
// Vercel sets VERCEL=1 and manages its own output format — standalone must be off there.
//
// On Vercel, disable webpack persistent disk cache to avoid flaky restores when the
// bundler or Next version changes across deploys (see vercel.json NODE_OPTIONS as well).
const nextConfig: NextConfig = {
  output: process.env.VERCEL ? undefined : "standalone",

  webpack(config) {
    if (process.env.VERCEL) {
      config.cache = false;
    }
    return config;
  },
};

export default nextConfig;
