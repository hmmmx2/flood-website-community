"use client";

// QA P1-5 — Top-level error boundary. Catches any unhandled exception
// from server components / API route boundaries and renders a friendly
// recovery surface instead of Next.js's raw error overlay.
//
// `error.tsx` MUST be a client component (Next.js requirement).

import { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to console + ship to Vercel logs. Sentry / Datadog wiring
    // would go here as a follow-up.
    console.error("[community/error] unhandled exception", error);
  }, [error]);

  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center px-6 text-center"
      style={{ background: "var(--color-bg)", color: "var(--color-text)" }}
    >
      <p
        className="text-sm font-semibold uppercase tracking-widest"
        style={{ color: "var(--color-muted)" }}
      >
        Something went wrong
      </p>
      <h1 className="mt-3 text-3xl font-bold sm:text-4xl">
        We hit an unexpected error
      </h1>
      <p
        className="mt-3 max-w-md text-sm sm:text-base"
        style={{ color: "var(--color-muted)" }}
      >
        The page couldn&apos;t be rendered. You can try again, or head back
        to the home feed. If this keeps happening, the team has been notified.
      </p>
      {error?.digest && (
        <p
          className="mt-2 font-mono text-xs"
          style={{ color: "var(--color-muted)" }}
        >
          Reference: {error.digest}
        </p>
      )}

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-xl bg-[var(--color-brand)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[var(--color-brand-dark)]"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-xl border px-5 py-2.5 text-sm font-semibold hover:bg-black/5 dark:hover:bg-white/5"
          style={{ borderColor: "var(--color-border)" }}
        >
          Home feed
        </Link>
      </div>
    </main>
  );
}
