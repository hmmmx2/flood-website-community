import type { NextConfig } from "next";
import * as fs from "fs";
import * as path from "path";

/** Minimal compiler surface for debug taps (avoids direct `webpack` package import). */
type WebpackCompilerHooks = {
  hooks: {
    compile: { tap: (name: string, fn: () => void) => void };
    afterCompile: { tap: (name: string, fn: () => void) => void };
    done: {
      tap: (
        name: string,
        fn: (stats: { hasErrors: () => boolean; hasWarnings: () => boolean }) => void,
      ) => void;
    };
    failed: { tap: (name: string, fn: (err: unknown) => void) => void };
  };
};

// #region agent log
const AGENT_DEBUG_LOG = path.join(__dirname, "..", ".cursor", "debug.log");
const AGENT_INGEST =
  "http://127.0.0.1:7242/ingest/d5db51c0-fa08-49b0-a6bb-c1b119e93725";

function agentDebug(payload: {
  hypothesisId: string;
  location: string;
  message: string;
  data?: Record<string, unknown>;
  runId?: string;
}) {
  const line = JSON.stringify({ ...payload, timestamp: Date.now() }) + "\n";
  try {
    fs.mkdirSync(path.dirname(AGENT_DEBUG_LOG), { recursive: true });
    fs.appendFileSync(AGENT_DEBUG_LOG, line, "utf8");
  } catch {
    /* ignore disk errors (e.g. read-only CI without workspace .cursor) */
  }
  void fetch(AGENT_INGEST, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, timestamp: Date.now() }),
  }).catch(() => {});
}

agentDebug({
  hypothesisId: "H4",
  location: "next.config.ts:module",
  message: "next_config_module_loaded",
  data: {
    vercel: Boolean(process.env.VERCEL),
    ci: Boolean(process.env.CI),
    node: process.version,
    cwd: process.cwd(),
  },
});
// #endregion

// `output: "standalone"` is required for Docker (copies only runtime files).
// Vercel sets VERCEL=1 and manages its own output format — standalone must be off there.
const nextConfig: NextConfig = {
  output: process.env.VERCEL ? undefined : "standalone",

  webpack(config, context) {
    // #region agent log
    const { isServer, dev, nextRuntime } = context;

    // H3: Vercel restores `.next` cache across deploys; a prior Turbopack (or mixed)
    // cache can destabilize webpack. Disable persistent cache on Vercel only.
    if (process.env.VERCEL) {
      config.cache = false;
      agentDebug({
        hypothesisId: "H3",
        location: "next.config.ts:webpack",
        message: "webpack_persistent_cache_disabled",
        data: { reason: "VERCEL" },
      });
    }

    agentDebug({
      hypothesisId: "H1",
      location: "next.config.ts:webpack",
      message: "webpack_fn_invoked",
      data: { isServer, dev, nextRuntime: nextRuntime ?? null },
    });

    const plugin = {
      apply(compiler: WebpackCompilerHooks) {
        compiler.hooks.compile.tap("AgentDebugCompile", () => {
          agentDebug({
            hypothesisId: "H1",
            location: "next.config.ts:compile",
            message: "webpack_compile_start",
            data: { isServer, dev },
          });
        });
        compiler.hooks.afterCompile.tap("AgentDebugAfterCompile", () => {
          agentDebug({
            hypothesisId: "H1",
            location: "next.config.ts:afterCompile",
            message: "webpack_after_compile",
            data: { isServer, dev },
          });
        });
        compiler.hooks.done.tap("AgentDebugDone", (stats) => {
          agentDebug({
            hypothesisId: "H1",
            location: "next.config.ts:done",
            message: "webpack_compile_done",
            data: {
              isServer,
              dev,
              hasErrors: stats.hasErrors(),
              hasWarnings: stats.hasWarnings(),
            },
          });
        });
        compiler.hooks.failed.tap("AgentDebugFailed", (err) => {
          agentDebug({
            hypothesisId: "H2",
            location: "next.config.ts:failed",
            message: "webpack_compile_failed",
            data: {
              isServer,
              message: err instanceof Error ? err.message : String(err),
            },
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
