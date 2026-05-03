"use client";

import Link from "next/link";
import Image from "next/image";
import { ThemeToggle } from "@/lib/theme/ThemeToggle";

/** Top bar for login / register / password flows — matches main app tokens + theme toggle. */
export function AuthTopNav() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-[var(--color-border)] bg-[var(--color-card)]/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 min-w-0">
          <Image
            src="/images/logo.png"
            alt="FloodWatch"
            width={36}
            height={36}
            className="shrink-0"
            priority
          />
          <span className="hidden sm:block text-sm font-semibold text-[var(--color-text)] truncate">
            FloodWatch Community
          </span>
        </Link>
        <ThemeToggle compact className="shrink-0" />
      </div>
    </nav>
  );
}

export function AuthFooter() {
  return (
    <footer className="border-t border-[var(--color-border)] bg-[var(--color-card)]/90 backdrop-blur-sm py-4">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2">
        <p className="text-xs text-[var(--color-muted)]">
          © {new Date().getFullYear()} FloodWatch Community. All rights reserved.
        </p>
        <div className="flex items-center gap-4">
          <a href="#" className="text-xs text-[var(--color-muted)] transition hover:opacity-80">
            Privacy Policy
          </a>
          <a href="#" className="text-xs text-[var(--color-muted)] transition hover:opacity-80">
            Terms of Service
          </a>
          <a href="#" className="text-xs text-[var(--color-muted)] transition hover:opacity-80">
            Contact
          </a>
        </div>
      </div>
    </footer>
  );
}
