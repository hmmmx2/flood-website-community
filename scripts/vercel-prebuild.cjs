"use strict";

/**
 * Runs at the start of Vercel `buildCommand` (Linux) before `next build`.
 * Clears paths that a restored Vercel build cache can leave in a bad state
 * (hang after "Creating an optimized production build …").
 */
const fs = require("fs");
const path = require("path");

if (!process.env.VERCEL) {
  process.exit(0);
}

const dirs = [
  ".next",
  path.join("node_modules", ".cache"),
  ".swc",
];

console.log("[vercel-prebuild] VERCEL=1 — removing:", dirs.join(", "));

for (const d of dirs) {
  try {
    fs.rmSync(d, { recursive: true, force: true });
    console.log("[vercel-prebuild] removed", d);
  } catch (e) {
    console.log("[vercel-prebuild] skip", d, String(e && e.message ? e.message : e));
  }
}
