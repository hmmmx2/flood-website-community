"use client";

import Link from "next/link";
import Image from "next/image";
import { ThemeToggle } from "@/lib/theme/ThemeToggle";
import { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { getInitials } from "@/lib/auth";
import type { AuthUser } from "@/lib/auth";

export interface NavbarProps {
  user: AuthUser | null;
  /** Custom logout handler. Falls back to signOut({ callbackUrl: "/login" }). */
  onLogout?: () => void;
  /** When provided a search icon / bar is rendered. */
  onSearchOpen?: () => void;
  /** Highlights the matching nav link. Pass null to show links without highlight. */
  activeLink?: "community" | "blog" | "sensors" | null;
  /** Breadcrumb shown for inner pages (replaces nav links). */
  breadcrumb?: { label: string; href?: string } | null;
}

const NAV_LINKS = [
  { key: "community" as const, href: "/", label: "Community" },
  { key: "blog" as const, href: "/blog", label: "Blog" },
  { key: "sensors" as const, href: "/sensors", label: "Sensors" },
];

/* ── tiny inline SVG icons ─────────────────────────────────────────────── */

function SearchIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" className="h-4 w-4 flex-shrink-0">
      <circle cx="11" cy="11" r="7" />
      <path strokeLinecap="round" d="M16.5 16.5L21 21" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
      className="h-4 w-4 flex-shrink-0 text-[var(--color-muted)]">
      <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
      strokeWidth="1.8" stroke="currentColor" className="h-4 w-4 flex-shrink-0">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function SignOutIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
      strokeWidth="1.8" stroke="currentColor" className="h-4 w-4 flex-shrink-0">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
    </svg>
  );
}

function HamburgerIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

/* ── Navbar component ───────────────────────────────────────────────────── */

export default function Navbar({
  user,
  onLogout,
  onSearchOpen,
  activeLink,
  breadcrumb,
}: NavbarProps) {
  const router = useRouter();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const mobileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!userMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [userMenuOpen]);

  useEffect(() => {
    if (!mobileOpen) return;
    const handler = (e: MouseEvent) => {
      if (mobileRef.current && !mobileRef.current.contains(e.target as Node)) {
        setMobileOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [mobileOpen]);

  function logout() {
    setUserMenuOpen(false);
    setMobileOpen(false);
    if (onLogout) {
      onLogout();
    } else {
      void signOut({ callbackUrl: "/login" });
    }
  }

  const showNavLinks = activeLink !== undefined && !breadcrumb;

  return (
    <header className="sticky top-0 z-40 bg-[var(--color-card)] border-b border-[var(--color-border)] shadow-sm">
      <div className="mx-auto max-w-5xl flex items-center gap-3 h-14 px-4">

        {/* ── Logo ───────────────────────────────────────────────────────── */}
        <Link
          href="/"
          className="flex items-center gap-2 font-bold text-[var(--color-text)] flex-shrink-0"
        >
          <div className="h-8 w-8 rounded-xl bg-[var(--color-card)] border border-[var(--color-border)] flex items-center justify-center p-0.5 flex-shrink-0">
            <Image src="/images/logo.png" alt="Pop Up Advertising And Information Enterprise" width={28} height={28} priority />
          </div>
          <span className="hidden sm:block text-base">FloodWatch</span>
        </Link>

        {/* ── Breadcrumb (inner pages) ───────────────────────────────────── */}
        {breadcrumb && (
          <>
            <span className="text-[var(--color-border)] hidden sm:block flex-shrink-0">/</span>
            {breadcrumb.href ? (
              <Link
                href={breadcrumb.href}
                className="hidden sm:block text-sm text-[var(--color-muted)] truncate max-w-[160px] hover:text-[var(--color-brand)] transition-colors"
              >
                {breadcrumb.label}
              </Link>
            ) : (
              <span className="hidden sm:block text-sm font-bold text-[var(--color-text)] truncate max-w-[160px]">
                {breadcrumb.label}
              </span>
            )}
          </>
        )}

        {/* ── Desktop nav links ─────────────────────────────────────────── */}
        {showNavLinks && (
          <nav className="hidden md:flex items-center gap-1 flex-shrink-0">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.key}
                href={link.href}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  activeLink === link.key
                    ? "font-semibold text-[var(--color-brand)] bg-[var(--color-brand-light)]"
                    : "font-medium text-[var(--color-muted)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text)]"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        )}

        {/* ── Search ───────────────────────────────────────────────────── */}
        {onSearchOpen && (
          <>
            {/* Expanded bar on sm+ */}
            <button
              type="button"
              onClick={onSearchOpen}
              className="hidden sm:flex flex-1 min-w-0 items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-input-bg)] px-4 py-2 text-sm text-[var(--color-muted)] hover:border-[var(--color-brand)] hover:bg-[var(--color-hover)] transition text-left max-w-xs"
            >
              <SearchIcon />
              <span className="truncate">Search posts and communities…</span>
              <kbd className="ml-auto flex-shrink-0 text-xs text-[var(--color-muted)] bg-[var(--color-hover)] px-1.5 py-0.5 rounded hidden lg:block">
                ⌘K
              </kbd>
            </button>
            {/* Icon-only on mobile */}
            <button
              type="button"
              onClick={onSearchOpen}
              className="sm:hidden flex items-center justify-center h-9 w-9 rounded-full border border-[var(--color-border)] text-[var(--color-muted)] hover:border-[var(--color-brand)] hover:text-[var(--color-brand)] transition flex-shrink-0"
              aria-label="Search"
            >
              <SearchIcon />
            </button>
          </>
        )}

        {/* Flex spacer when there is no search bar */}
        {!onSearchOpen && <div className="flex-1" />}

        <div className="flex-shrink-0">
          <ThemeToggle compact />
        </div>

        {/* ── Desktop auth ─────────────────────────────────────────────── */}
        {user ? (
          <div className="relative hidden sm:block flex-shrink-0" ref={userMenuRef}>
            <button
              type="button"
              onClick={() => setUserMenuOpen((o) => !o)}
              className="flex items-center gap-2 rounded-full border border-[var(--color-border)] px-3 py-1.5 hover:bg-[var(--color-hover)] transition"
            >
              {user.avatarUrl ? (
                <div className="h-6 w-6 rounded-full overflow-hidden flex-shrink-0 border border-[var(--color-border)]">
                  <Image
                    src={user.avatarUrl}
                    alt={user.displayName}
                    width={24}
                    height={24}
                    className="h-full w-full object-cover"
                    unoptimized
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = "none";
                      const fallback = e.currentTarget.nextElementSibling as HTMLElement | null;
                      if (fallback) fallback.style.display = "flex";
                    }}
                  />
                  <span
                    style={{ display: "none" }}
                    className="h-6 w-6 rounded-full bg-[var(--color-brand)] items-center justify-center text-[10px] font-bold text-white"
                  >
                    {getInitials(user.displayName)}
                  </span>
                </div>
              ) : (
                <div className="h-6 w-6 rounded-full bg-[var(--color-brand)] flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">
                  {getInitials(user.displayName)}
                </div>
              )}
              <span className="text-sm font-semibold text-[var(--color-text)] max-w-[120px] truncate">
                {user.displayName}
              </span>
              <ChevronDownIcon />
            </button>

            {userMenuOpen && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-[var(--color-card)] rounded-xl border border-[var(--color-border)] shadow-lg overflow-hidden z-50">
                <Link
                  href="/settings"
                  onClick={() => setUserMenuOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-[var(--color-text)] hover:bg-[var(--color-hover)] transition font-medium"
                >
                  <SettingsIcon />
                  Settings
                </Link>
                <div className="border-t border-[var(--color-border)]" />
                <button
                  type="button"
                  onClick={logout}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition font-semibold"
                >
                  <SignOutIcon />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
            <Link
              href="/login"
              className="rounded-full border border-[var(--color-brand)] px-4 py-1.5 text-sm font-bold text-[var(--color-brand)] hover:bg-blue-50 transition"
            >
              Log In
            </Link>
            <Link
              href="/register"
              className="rounded-full bg-[var(--color-brand)] px-4 py-1.5 text-sm font-bold text-white hover:bg-[var(--color-brand-dark)] transition"
            >
              Sign Up
            </Link>
          </div>
        )}

        {/* ── Mobile hamburger ─────────────────────────────────────────── */}
        <div className="relative sm:hidden flex-shrink-0" ref={mobileRef}>
          <button
            type="button"
            onClick={() => setMobileOpen((o) => !o)}
            className="flex items-center justify-center h-9 w-9 rounded-lg text-[var(--color-muted)] hover:bg-[var(--color-hover)] transition"
            aria-label="Toggle menu"
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <XIcon /> : <HamburgerIcon />}
          </button>

          {mobileOpen && (
            <div className="absolute right-0 top-full mt-1 w-64 bg-[var(--color-card)] rounded-2xl border border-[var(--color-border)] shadow-xl overflow-hidden z-50">
              {/* Nav links section */}
              {showNavLinks && (
                <div className="p-2 border-b border-[var(--color-border)]">
                  {NAV_LINKS.map((link) => (
                    <Link
                      key={link.key}
                      href={link.href}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                        activeLink === link.key
                          ? "text-[var(--color-brand)] bg-blue-50 font-semibold"
                          : "text-[var(--color-text)] hover:bg-[var(--color-hover)]"
                      }`}
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              )}

              {/* Auth section */}
              {user ? (
                <div className="p-2">
                  <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-[var(--color-hover)] mb-1">
                    {user.avatarUrl ? (
                      <div className="h-7 w-7 rounded-full overflow-hidden flex-shrink-0 border border-[var(--color-border)]">
                        <Image
                          src={user.avatarUrl}
                          alt={user.displayName}
                          width={28}
                          height={28}
                          className="h-full w-full object-cover"
                          unoptimized
                        />
                      </div>
                    ) : (
                      <div className="h-7 w-7 rounded-full bg-[var(--color-brand)] flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">
                        {getInitials(user.displayName)}
                      </div>
                    )}
                    <span className="text-sm font-semibold text-[var(--color-text)] truncate">
                      {user.displayName}
                    </span>
                  </div>
                  <Link
                    href="/settings"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-[var(--color-text)] hover:bg-[var(--color-hover)] transition font-medium rounded-xl"
                  >
                    <SettingsIcon />
                    Settings
                  </Link>
                  <button
                    type="button"
                    onClick={logout}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-red-500 hover:bg-red-50 transition font-semibold rounded-xl"
                  >
                    <SignOutIcon />
                    Sign Out
                  </button>
                </div>
              ) : (
                <div className="p-3 flex flex-col gap-2">
                  <Link
                    href="/login"
                    onClick={() => setMobileOpen(false)}
                    className="block w-full rounded-xl border border-[var(--color-brand)] px-4 py-2.5 text-sm font-bold text-[var(--color-brand)] hover:bg-blue-50 transition text-center"
                  >
                    Log In
                  </Link>
                  <Link
                    href="/register"
                    onClick={() => setMobileOpen(false)}
                    className="block w-full rounded-xl bg-[var(--color-brand)] px-4 py-2.5 text-sm font-bold text-white hover:bg-[var(--color-brand-dark)] transition text-center"
                  >
                    Sign Up
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
