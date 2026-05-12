"use client";

import Image from "next/image";
import Link from "next/link";

const footerLinks = [
  {
    heading: "Community",
    links: [
      { label: "Home", href: "/" },
      { label: "Communities", href: "/" },
      { label: "Create Post", href: "/?create=1" },
    ],
  },
  {
    heading: "Support",
    links: [
      { label: "Help Centre", href: "#" },
      { label: "Privacy Policy", href: "#" },
      { label: "Terms of Service", href: "#" },
    ],
  },
  {
    heading: "Emergency",
    links: [
      { label: "Civil Defence (APM) — 991", href: "tel:991" },
      { label: "Police — 999", href: "tel:999" },
      { label: "Bomba — 994", href: "tel:994" },
      { label: "JPS Hotline — 1800-88-2773", href: "tel:1800882773" },
    ],
  },
];

const socialLinks = [
  {
    label: "Facebook",
    href: "https://www.facebook.com/",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    ),
  },
  {
    label: "X",
    href: "https://x.com/",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  {
    label: "Instagram",
    href: "https://www.instagram.com/",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
      </svg>
    ),
  },
];

export default function Footer() {
  // Colour palette is intentionally hard-coded to the shared FloodWatch
  // footer tokens (defined once in lib/theme/tokens.css). The colour
  // stays identical between the community site and the CRM, regardless
  // of light or dark theme, so users always recognise the same brand
  // bar at the bottom of every site.
  return (
    <footer
      className="mt-8"
      style={{ background: "var(--color-footer-bg)", color: "var(--color-footer-fg)" }}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="lg:col-span-1">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-xl bg-white flex items-center justify-center p-1 flex-shrink-0">
                <Image src="/images/logo.png" alt="Pop Up Advertising And Information Enterprise" width={32} height={32} />
              </div>
              <div>
                <p className="font-bold text-sm leading-tight">FloodWatch</p>
                <p className="text-[10px] leading-tight" style={{ color: "var(--color-footer-muted)" }}>
                  by Pop Up Advertising &amp; Information Enterprise
                </p>
              </div>
            </div>
            <p className="text-xs leading-relaxed mb-4" style={{ color: "var(--color-footer-muted)" }}>
              A community platform for Malaysians to share real-time flood updates and stay safe together.
            </p>
            <div className="flex items-center gap-2">
              {socialLinks.map(s => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  className="h-8 w-8 rounded-lg flex items-center justify-center transition-colors hover:bg-white/20"
                  style={{ background: "var(--color-footer-bar)" }}
                >
                  {s.icon}
                </a>
              ))}
            </div>
          </div>

          {/* Nav columns */}
          {footerLinks.map(col => (
            <div key={col.heading}>
              <h4 className="text-xs font-bold uppercase tracking-wider mb-3">{col.heading}</h4>
              <ul className="space-y-2">
                {col.links.map(l => (
                  <li key={l.label}>
                    <Link
                      href={l.href}
                      className="text-xs transition-colors hover:text-white"
                      style={{ color: "var(--color-footer-muted)" }}
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div
          className="mt-8 pt-6 flex flex-col sm:flex-row items-center justify-between gap-2 border-t"
          style={{ borderColor: "var(--color-footer-bar)" }}
        >
          <p className="text-xs" style={{ color: "var(--color-footer-muted)" }}>
            © {new Date().getFullYear()} Pop Up Advertising And Information Enterprise. All rights reserved.
          </p>
          <p className="text-xs" style={{ color: "var(--color-footer-muted)" }}>
            Built for Malaysia&apos;s flood resilience community
          </p>
        </div>
      </div>
    </footer>
  );
}
