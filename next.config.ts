import type { NextConfig } from "next";
import * as fs from "fs";
import * as path from "path";

// #region agent log
const AGENT_INGEST =
  "http://127.0.0.1:7242/ingest/d5db51c0-fa08-49b0-a6bb-c1b119e93725";
const AGENT_DEBUG_LOG = path.join(__dirname, "..", ".cursor", "debug.log");

function buildDebug(evt: string, data: Record<string, unknown>) {
  const payload = {
    hypothesisId: "H12",
    location: "next.config.ts",
    message: evt,
    data,
    timestamp: Date.now(),
  };
  if (process.env.VERCEL) {
    // CI: Vercel log stream (no workspace .cursor path on Linux builders).
    console.warn("[flood-community-build]", JSON.stringify(payload));
  } else {
    try {
      fs.mkdirSync(path.dirname(AGENT_DEBUG_LOG), { recursive: true });
      fs.appendFileSync(AGENT_DEBUG_LOG, JSON.stringify(payload) + "\n", "utf8");
    } catch {
      /* ignore */
    }
  }
  void fetch(AGENT_INGEST, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => {});
}
// #endregion

// `output: "standalone"` is required for Docker (copies only runtime files).
// Vercel sets VERCEL=1 and manages its own output format — standalone must be off there.
//
// H12: `cache: false` can increase peak memory / time on small builders. Use in-memory
// webpack cache on Vercel only (no restored disk cache blobs, still bounded).
const nextConfig: NextConfig = {
  output: process.env.VERCEL ? undefined : "standalone",

  webpack(config, context) {
    // #region agent log
    buildDebug("webpack_invoked", {
      isServer: context.isServer,
      dev: context.dev,
      nextRuntime: context.nextRuntime ?? null,
    });
    // #endregion

    if (process.env.VERCEL) {
      config.cache = { type: "memory" };
    }

    // #region agent log
    const plugin = {
      apply(compiler: {
        hooks: {
          compile: { tap: (n: string, fn: () => void) => void };
          done: {
            tap: (
              n: string,
              fn: (s: { hasErrors: () => boolean }) => void,
            ) => void;
          };
        };
      }) {
        compiler.hooks.compile.tap("AgentBuild", () => {
          buildDebug("webpack_compile_start", {
            isServer: context.isServer,
          });
        });
        compiler.hooks.done.tap("AgentBuild", (stats) => {
          buildDebug("webpack_compile_done", {
            isServer: context.isServer,
            hasErrors: stats.hasErrors(),
          });
        });
      },
    };
    config.plugins = config.plugins ?? [];
    config.plugins.push(plugin);
    // #endregion

    return config;
  },
};

export default nextConfig;
