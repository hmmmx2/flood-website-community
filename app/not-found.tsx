// QA P1-5 — Replace Next.js's bare-bones default 404 with a branded
// fallback. Avoids the "wait, did the site break?" reaction when a
// stale link is followed (deleted post, renamed blog slug, etc.).

import Link from "next/link";

export default function NotFound() {
  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center px-6 text-center"
      style={{ background: "var(--color-bg)", color: "var(--color-text)" }}
    >
      <p
        className="text-sm font-semibold uppercase tracking-widest"
        style={{ color: "var(--color-muted)" }}
      >
        404
      </p>
      <h1 className="mt-3 text-3xl font-bold sm:text-4xl">
        We couldn&apos;t find that page
      </h1>
      <p className="mt-3 max-w-md text-sm sm:text-base" style={{ color: "var(--color-muted)" }}>
        The link may be broken, or the page may have been moved. Try the home
        feed or the flood map to find what you&apos;re looking for.
      </p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="rounded-xl bg-[var(--color-brand)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[var(--color-brand-dark)]"
        >
          Home feed
        </Link>
        <Link
          href="/flood-map"
          className="rounded-xl border px-5 py-2.5 text-sm font-semibold hover:bg-black/5 dark:hover:bg-white/5"
          style={{ borderColor: "var(--color-border)" }}
        >
          Flood map
        </Link>
      </div>
    </main>
  );
}
