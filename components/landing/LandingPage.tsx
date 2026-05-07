"use client";

/**
 * Public landing page rendered at "/" for unauthenticated visitors.
 *
 * Editorial / Claude-inspired aesthetic: warm off-white paper background,
 * serif display headlines paired with sans-serif body, a single ink CTA,
 * and a "How it works" sequence that animates in on scroll. Logged-in
 * users continue to see the community feed (the existing HomePage logic
 * remains; this component is only mounted when the session is null).
 *
 * IMPORTANT: all CSS custom properties live in a <style jsx global> block
 * scoped to [data-landing-root]. We tried setting them via inline style
 * with a TS cast (style={{ ['--landing-ink']: '#1f1d1a' }}) but React +
 * Turbopack stripped the unknown property keys at runtime, leaving the
 * var() references unresolved and the headline rendering near-white on
 * cream. The global stylesheet approach gives us deterministic resolution
 * in both dev and production builds.
 */

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ThemeToggle } from "@/lib/theme/ThemeToggle";

// ── Type ───────────────────────────────────────────────────────────────────

type LandingStat = { online: number; reportsThisYear: number };

// ── Hero ───────────────────────────────────────────────────────────────────

function Hero({ stat }: { stat: LandingStat }) {
  return (
    <section className="relative overflow-hidden landing-hero">
      {/* Soft ambient watercolor backdrop — purely decorative, fades behind text */}
      <div aria-hidden className="landing-hero-glow" />
      <div className="relative mx-auto max-w-3xl px-6 pt-28 pb-32 sm:pt-36 sm:pb-44">
        <p className="landing-eyebrow">
          Community-driven flood monitoring · Sarawak
        </p>
        <h1 className="landing-h1">
          Know the water<br />
          before it knows<br />
          your street.
        </h1>
        <p className="landing-lede">
          A live network of neighbour-run sensors and on-the-ground reports —
          built for Sarawak&apos;s streets, kampungs, and rivers.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3">
          <Link href="/register" className="landing-cta-primary">
            Join Community
            <span aria-hidden>→</span>
          </Link>
          <Link href="/flood-map" className="landing-cta-secondary">
            See the live map
          </Link>
        </div>
        <div className="landing-trustrow">
          <span className="inline-flex items-center gap-2">
            <span className="landing-pulsedot" aria-hidden />
            Live · {stat.online.toLocaleString()} sensors online
          </span>
          <span aria-hidden>·</span>
          <span>{stat.reportsThisYear.toLocaleString()} community reports this year</span>
        </div>
      </div>
    </section>
  );
}

// ── Live Pulse ─────────────────────────────────────────────────────────────

const PULSE_STORIES = [
  {
    when: "02:14 AM",
    where: "Sungai Sarawak Kanan",
    quote:
      "Water rising fast near Pasar Satok. Headed inland, friends in Petra Jaya please prepare.",
    author: "Mei Lin",
    role: "Resident · Level 2",
    severity: "warning" as const,
  },
  {
    when: "01:47 AM",
    where: "Jalan Petra Jaya",
    quote:
      "Road impassable past KFC junction — two cars stuck. Use AH150 instead.",
    author: "Faizal",
    role: "NGO Volunteer",
    severity: "critical" as const,
  },
  {
    when: "12:30 AM",
    where: "Kampung Boyan",
    quote: "All clear after the morning. Drains have been cleared by JKR.",
    author: "Datuk Khairul",
    role: "Admin",
    severity: "resolved" as const,
  },
];

function severityToken(s: "warning" | "critical" | "resolved") {
  switch (s) {
    case "critical": return { dot: "#dc2626", label: "Critical" };
    case "warning":  return { dot: "#f97316", label: "Warning" };
    default:         return { dot: "#22c55e", label: "Resolved" };
  }
}

function LivePulse({ stat }: { stat: LandingStat }) {
  return (
    <section className="landing-pulse">
      <div className="mx-auto max-w-5xl px-6 py-24 sm:py-32">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="landing-eyebrow">Live Pulse · Happening now</p>
            <h2 className="landing-h2">Right now in Sarawak</h2>
          </div>
          <p className="landing-meta">
            Updated <span className="tabular-nums">just now</span>
          </p>
        </div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {PULSE_STORIES.map((s, i) => {
            const tok = severityToken(s.severity);
            return (
              <article key={i} className="landing-pulsecard">
                <p className="landing-pulsemeta">
                  {s.when} · {s.where}
                </p>
                <p className="landing-pulsequote">&ldquo;{s.quote}&rdquo;</p>
                <p className="landing-pulseauthor">
                  — {s.author}, <span className="landing-pulserole">{s.role}</span>
                </p>
                <p className="landing-severity" style={{ color: tok.dot }}>
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ background: tok.dot }}
                    aria-hidden
                  />
                  {tok.label}
                </p>
              </article>
            );
          })}
        </div>

        <p className="mt-12 landing-meta">
          {stat.reportsThisYear.toLocaleString()} reports filed by the community this year ·{" "}
          <Link href="/blog" className="landing-link">
            Read the stories →
          </Link>
        </p>
      </div>
    </section>
  );
}

// ── How It Works ───────────────────────────────────────────────────────────

const STEPS = [
  {
    n: "01",
    title: "Sense",
    body: "Sensors along major rivers ping water level every 60 seconds.",
  },
  {
    n: "02",
    title: "Report",
    body: "Anyone on the ground can pin a location, snap a photo, write one line.",
  },
  {
    n: "03",
    title: "Alert",
    body: "We push it to the right people — neighbours, JBPM, Bomba — in seconds.",
  },
] as const;

function HowItWorks() {
  const stepRefs = useRef<(HTMLLIElement | null)[]>([]);
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            const idx = Number((e.target as HTMLElement).dataset.idx ?? "0");
            setActiveStep(idx);
          }
        }
      },
      { rootMargin: "-40% 0px -40% 0px", threshold: 0.01 },
    );
    stepRefs.current.forEach((el) => el && obs.observe(el));
    return () => obs.disconnect();
  }, []);

  return (
    <section className="mx-auto max-w-5xl px-6 py-24 sm:py-32">
      <p className="landing-eyebrow">How it works</p>
      <h2 className="landing-h2 mt-3">Three steps, no jargon.</h2>

      <div className="mt-16 grid gap-12 lg:grid-cols-2 lg:gap-16">
        <ol className="space-y-12">
          {STEPS.map((s, i) => (
            <li
              key={s.n}
              ref={(el) => { stepRefs.current[i] = el; }}
              data-idx={i}
              className={`landing-step ${activeStep === i ? "is-active" : ""}`}
            >
              <p className="landing-stepnum">{s.n}</p>
              <h3 className="landing-steptitle">{s.title}</h3>
              <p className="landing-stepbody">{s.body}</p>
            </li>
          ))}
        </ol>

        <div className="hidden lg:block">
          <div className="sticky top-32">
            <HowItWorksIllustration step={activeStep} />
          </div>
        </div>
      </div>
    </section>
  );
}

function HowItWorksIllustration({ step }: { step: number }) {
  return (
    <div className="landing-illustration aspect-[4/3] w-full overflow-hidden rounded-2xl border p-6">
      <svg viewBox="0 0 400 300" className="h-full w-full">
        <defs>
          <linearGradient id="river" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#7dd3fc" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#0284c7" stopOpacity="0.6" />
          </linearGradient>
        </defs>
        <path
          d="M 0 180 Q 100 130 200 170 T 400 150"
          fill="none"
          stroke="url(#river)"
          strokeWidth="22"
          strokeLinecap="round"
        />
        {[
          { x: 60, y: 175 },
          { x: 160, y: 158 },
          { x: 260, y: 162 },
          { x: 340, y: 152 },
        ].map((s, i) => (
          <g key={i}>
            <circle cx={s.x} cy={s.y} r="9" fill="#0ea5e9" opacity="0.18" />
            <circle cx={s.x} cy={s.y} r="4" fill="#0284c7">
              <animate
                attributeName="r"
                values="4;6;4"
                dur="2.4s"
                repeatCount="indefinite"
                begin={`${i * 0.4}s`}
              />
            </circle>
          </g>
        ))}
        <g
          style={{
            opacity: step >= 1 ? 1 : 0,
            transform: step >= 1 ? "translateY(0)" : "translateY(-12px)",
            transition: "opacity 500ms, transform 500ms cubic-bezier(0.16,1,0.3,1)",
            transformOrigin: "210px 158px",
          }}
        >
          <path
            d="M 210 130 C 220 130 226 138 226 146 C 226 158 210 174 210 174 C 210 174 194 158 194 146 C 194 138 200 130 210 130 Z"
            fill="#dc2626"
            stroke="#7f1d1d"
            strokeWidth="2"
          />
          <circle cx="210" cy="146" r="5" fill="#fef2f2" />
        </g>
        <g
          style={{
            opacity: step >= 1 ? 1 : 0,
            transition: "opacity 600ms 200ms",
          }}
        >
          <rect x="240" y="120" width="120" height="46" rx="8" fill="white" stroke="#e7e3d8" />
          <rect x="248" y="128" width="22" height="22" rx="4" fill="#0ea5e9" opacity="0.2" />
          <rect x="278" y="130" width="70" height="6" rx="3" fill="#1f1d1a" />
          <rect x="278" y="142" width="50" height="5" rx="2" fill="#5b5750" />
          <rect x="278" y="152" width="60" height="5" rx="2" fill="#5b5750" />
        </g>
        {step >= 2 && (
          <>
            {[16, 30, 46].map((r, i) => (
              <circle
                key={r}
                cx="210"
                cy="158"
                r={r}
                fill="none"
                stroke="#dc2626"
                strokeOpacity="0.35"
              >
                <animate
                  attributeName="r"
                  values={`${r};${r + 24}`}
                  dur="1.6s"
                  begin={`${i * 0.18}s`}
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="stroke-opacity"
                  values="0.45;0"
                  dur="1.6s"
                  begin={`${i * 0.18}s`}
                  repeatCount="indefinite"
                />
              </circle>
            ))}
            {[
              { x: 90, y: 100 },
              { x: 320, y: 90 },
              { x: 100, y: 240 },
            ].map((a, i) => (
              <g key={i}>
                <circle cx={a.x} cy={a.y} r="14" fill="#1f1d1a" />
                <circle cx={a.x + 10} cy={a.y - 8} r="6" fill="#22c55e" stroke="white" strokeWidth="2" />
                <text
                  x={a.x + 10}
                  y={a.y - 5}
                  fontSize="8"
                  fill="white"
                  textAnchor="middle"
                  fontWeight="bold"
                >
                  ✓
                </text>
              </g>
            ))}
          </>
        )}
      </svg>
    </div>
  );
}

// ── Trust footer with emergency contacts ───────────────────────────────────

const EMERGENCY = [
  { label: "Bomba (Fire & Rescue)", number: "994" },
  { label: "Civil Defence (APM)",   number: "991" },
  { label: "Police",                number: "999" },
  { label: "JPS Flood Hotline",     number: "1800-88-2773" },
];

function LandingFooter() {
  return (
    <footer className="landing-footer">
      <div className="mx-auto max-w-5xl px-6 pt-24 pb-16">
        <h2 className="landing-footer-h2">
          In an emergency, do not rely on this site.
        </h2>
        <p className="landing-footer-lede">
          Tap a number on mobile to dial. FloodWatch supplements official channels — it does not replace them.
        </p>

        <div className="mt-10 grid gap-3 sm:grid-cols-2">
          {EMERGENCY.map((e) => (
            <a
              key={e.number}
              href={`tel:${e.number.replace(/[^0-9+]/g, "")}`}
              className="landing-emergency-card"
            >
              <span className="landing-emergency-label">{e.label}</span>
              <span className="landing-emergency-num">{e.number}</span>
            </a>
          ))}
        </div>

        <hr className="landing-divider my-12" />

        <p className="landing-colophon">
          FloodWatch is built by a small group of volunteers, students, and JKR engineers in Kuching.
          Sensors are funded by community donations and Universiti Malaysia Sarawak&apos;s IoT lab.
        </p>
        <p className="landing-tag">Open data · MIT-licensed code · No tracking</p>

        <div className="landing-footrow">
          <div className="flex items-center gap-2">
            <Image src="/images/logo.png" alt="FloodWatch" width={20} height={20} />
            <span>FloodWatch · Made in Sarawak · © 2026</span>
          </div>
          <nav className="flex flex-wrap gap-x-5 gap-y-1">
            <Link href="/login" className="hover:opacity-80">Log in</Link>
            <Link href="/blog" className="hover:opacity-80">Blog</Link>
            <Link href="/flood-map" className="hover:opacity-80">Map</Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}

// ── Top nav ─────────────────────────────────────────────────────────────────

function LandingNav() {
  return (
    <header className="landing-nav">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-6 px-6 py-4">
        <Link href="/" className="landing-brand">
          <Image src="/images/logo.png" alt="" width={28} height={28} />
          FloodWatch
        </Link>
        <nav className="hidden items-center gap-8 text-sm md:flex landing-nav-links">
          <Link href="#pulse">Pulse</Link>
          <Link href="/flood-map">Map</Link>
          <Link href="#how">How it works</Link>
          <Link href="/blog">Stories</Link>
        </nav>
        <div className="flex items-center gap-3">
          <ThemeToggle compact />
          <Link href="/register" className="landing-nav-cta">
            Join
          </Link>
        </div>
      </div>
    </header>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function LandingPage({ stat }: { stat?: LandingStat }) {
  const safeStat = stat ?? { online: 109, reportsThisYear: 2341 };

  return (
    <div data-landing-root className="landing-root">
      <style jsx global>{`
        /* ── Tokens — scoped to the landing page so we don't override
              the rest of the site. Defined in a real CSS rule rather than
              an inline style so React can't strip the custom property keys. */
        [data-landing-root] {
          --landing-paper: #f5f3ee;
          --landing-paper-elevated: #fffdf8;
          --landing-cream: #ece6d6;
          --landing-ink: #1a1815;
          --landing-ink-secondary: #4a463f;
          --landing-muted: #8a857d;
          --landing-hairline: #ddd8c9;
          --landing-hairline-strong: #c9c2af;
          --landing-accent: #c8492a;
          background: var(--landing-paper);
          color: var(--landing-ink);
          /* Subtle paper grain — gives the cream a sense of depth instead
             of flat colour. Pure-CSS noise via two small radial gradients. */
          background-image:
            radial-gradient(circle at 20% 10%, rgba(200, 73, 42, 0.04), transparent 40%),
            radial-gradient(circle at 90% 80%, rgba(13, 148, 136, 0.04), transparent 50%);
        }
        :root.dark [data-landing-root] {
          --landing-paper: #14130f;
          --landing-paper-elevated: #1c1b16;
          --landing-cream: #211f19;
          --landing-ink: #ece7d6;
          --landing-ink-secondary: #b8b2a4;
          --landing-muted: #7d7869;
          --landing-hairline: #2c2a23;
          --landing-hairline-strong: #3d3a31;
          --landing-accent: #f59e0b;
          background-image:
            radial-gradient(circle at 20% 10%, rgba(245, 158, 11, 0.06), transparent 40%),
            radial-gradient(circle at 90% 80%, rgba(13, 148, 136, 0.05), transparent 50%);
        }

        /* ── Typography */
        .landing-root * {
          font-family: var(--font-geist-sans, "Inter Tight"), system-ui, sans-serif;
        }
        .landing-h1, .landing-h2, .landing-footer-h2, .landing-steptitle {
          font-family: "Source Serif 4", "Iowan Old Style", "Apple Garamond", "Palatino", serif;
          font-weight: 500;
          letter-spacing: -0.02em;
        }
        .landing-eyebrow {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: var(--landing-muted);
        }
        .landing-h1 {
          margin-top: 24px;
          font-size: clamp(48px, 7vw, 88px);
          line-height: 1.02;
          color: var(--landing-ink);
        }
        .landing-h2 {
          font-size: clamp(34px, 4.4vw, 52px);
          line-height: 1.05;
          color: var(--landing-ink);
        }
        .landing-lede {
          margin-top: 32px;
          max-width: 38rem;
          font-size: 18px;
          line-height: 1.65;
          color: var(--landing-ink-secondary);
        }
        .landing-meta {
          font-size: 14px;
          color: var(--landing-ink-secondary);
        }
        .landing-link {
          font-weight: 600;
          color: var(--landing-ink);
          text-decoration: underline;
          text-underline-offset: 4px;
          text-decoration-color: var(--landing-hairline-strong);
        }
        .landing-link:hover { text-decoration-color: var(--landing-ink); }

        /* ── Nav */
        .landing-nav {
          position: sticky; top: 0; z-index: 30;
          backdrop-filter: blur(14px) saturate(140%);
          -webkit-backdrop-filter: blur(14px) saturate(140%);
          background: color-mix(in srgb, var(--landing-paper) 80%, transparent);
          border-bottom: 1px solid var(--landing-hairline);
        }
        .landing-brand {
          display: flex; align-items: center; gap: 10px;
          font-family: "Source Serif 4", serif;
          font-size: 19px; font-weight: 500; letter-spacing: -0.01em;
          color: var(--landing-ink);
        }
        .landing-nav-links a {
          color: var(--landing-ink-secondary);
          font-size: 14px;
          transition: color 160ms ease;
        }
        .landing-nav-links a:hover { color: var(--landing-ink); }
        .landing-nav-cta {
          display: inline-flex; align-items: center;
          padding: 8px 18px;
          border-radius: 999px;
          background: var(--landing-ink);
          color: var(--landing-paper);
          font-size: 13px; font-weight: 600;
          transition: opacity 160ms ease;
        }
        .landing-nav-cta:hover { opacity: 0.88; }

        /* ── Hero */
        .landing-hero {
          position: relative;
          /* Soft cream-tan gradient at the bottom edge so the next
             section's cream block tucks in without a hard line. */
          background: linear-gradient(180deg, transparent 80%, var(--landing-cream) 100%);
        }
        .landing-hero-glow {
          position: absolute;
          inset: -80px -120px auto auto;
          width: 520px; height: 520px;
          border-radius: 50%;
          background: radial-gradient(circle at center, rgba(200, 73, 42, 0.10), transparent 65%);
          filter: blur(40px);
          pointer-events: none;
        }
        :root.dark .landing-hero-glow {
          background: radial-gradient(circle at center, rgba(245, 158, 11, 0.10), transparent 65%);
        }
        .landing-cta-primary {
          display: inline-flex; align-items: center; gap: 10px;
          padding: 14px 28px;
          border-radius: 999px;
          background: var(--landing-ink);
          color: var(--landing-paper);
          font-size: 15px; font-weight: 600;
          box-shadow: 0 8px 24px -10px rgba(0,0,0,0.25);
          transition: transform 180ms cubic-bezier(0.16,1,0.3,1), opacity 180ms ease;
        }
        .landing-cta-primary:hover {
          transform: translateY(-1px);
          opacity: 0.92;
        }
        .landing-cta-secondary {
          font-size: 15px; font-weight: 600;
          color: var(--landing-ink);
          text-decoration: underline;
          text-underline-offset: 6px;
          text-decoration-color: var(--landing-hairline-strong);
          transition: text-decoration-color 160ms ease;
        }
        .landing-cta-secondary:hover { text-decoration-color: var(--landing-ink); }
        .landing-trustrow {
          margin-top: 56px;
          display: flex; flex-wrap: wrap;
          column-gap: 18px; row-gap: 6px;
          align-items: center;
          font-size: 13px;
          color: var(--landing-ink-secondary);
        }
        .landing-pulsedot {
          display: inline-block;
          width: 8px; height: 8px;
          border-radius: 50%;
          background: #16a34a;
          box-shadow: 0 0 10px #22c55e;
          animation: landing-pulse 2.2s ease-in-out infinite;
        }
        @keyframes landing-pulse {
          0%, 100% { opacity: 0.45; }
          50%      { opacity: 1; }
        }

        /* ── Live Pulse */
        .landing-pulse {
          background: var(--landing-cream);
          border-top: 1px solid var(--landing-hairline);
          border-bottom: 1px solid var(--landing-hairline);
        }
        .landing-pulsecard {
          background: var(--landing-paper-elevated);
          border: 1px solid var(--landing-hairline);
          border-radius: 16px;
          padding: 22px;
          transition: border-color 200ms ease, transform 200ms ease;
        }
        .landing-pulsecard:hover {
          border-color: var(--landing-hairline-strong);
          transform: translateY(-2px);
        }
        .landing-pulsemeta {
          font-size: 12px; font-weight: 500;
          color: var(--landing-muted);
          font-variant-numeric: tabular-nums;
        }
        .landing-pulsequote {
          margin-top: 14px;
          font-size: 15px; line-height: 1.55;
          color: var(--landing-ink);
        }
        .landing-pulseauthor {
          margin-top: 18px;
          font-size: 12px;
          color: var(--landing-ink-secondary);
        }
        .landing-pulserole { color: var(--landing-muted); }
        .landing-severity {
          margin-top: 14px;
          font-size: 11px; font-weight: 700;
          letter-spacing: 0.05em;
          display: inline-flex; align-items: center; gap: 8px;
        }

        /* ── How It Works */
        .landing-step {
          transition: color 500ms ease;
          color: var(--landing-muted);
        }
        .landing-step.is-active { color: var(--landing-ink); }
        .landing-step.is-active .landing-stepbody { color: var(--landing-ink-secondary); }
        .landing-stepnum {
          font-family: "JetBrains Mono", "Consolas", monospace;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.05em;
        }
        .landing-steptitle {
          margin-top: 8px;
          font-size: clamp(24px, 3vw, 36px);
          line-height: 1.1;
        }
        .landing-stepbody {
          margin-top: 10px;
          max-width: 28rem;
          font-size: 16px; line-height: 1.6;
          transition: color 500ms ease;
        }
        .landing-illustration {
          background: var(--landing-paper-elevated);
          border-color: var(--landing-hairline);
        }

        /* ── Footer */
        .landing-footer {
          border-top: 1px solid var(--landing-hairline);
        }
        .landing-footer-h2 {
          font-size: clamp(26px, 3.2vw, 36px);
          line-height: 1.15;
          color: var(--landing-ink);
        }
        .landing-footer-lede {
          margin-top: 10px;
          max-width: 36rem;
          font-size: 16px; line-height: 1.6;
          color: var(--landing-ink-secondary);
        }
        .landing-emergency-card {
          display: flex; align-items: center; justify-content: space-between;
          gap: 16px;
          padding: 18px 22px;
          border-radius: 16px;
          background: var(--landing-paper-elevated);
          border: 1px solid var(--landing-hairline);
          transition: border-color 160ms ease, transform 160ms ease;
        }
        .landing-emergency-card:hover {
          border-color: var(--landing-ink);
          transform: translateY(-1px);
        }
        .landing-emergency-label {
          font-size: 14px; font-weight: 600;
          color: var(--landing-ink);
        }
        .landing-emergency-num {
          font-family: "JetBrains Mono", "Consolas", monospace;
          font-size: 22px; font-weight: 600;
          color: var(--landing-ink);
          font-variant-numeric: tabular-nums;
        }
        .landing-divider { border-color: var(--landing-hairline); }
        .landing-colophon {
          max-width: 42rem;
          font-size: 14px; line-height: 1.65;
          color: var(--landing-ink-secondary);
        }
        .landing-tag {
          margin-top: 16px;
          font-size: 12px;
          color: var(--landing-muted);
        }
        .landing-footrow {
          margin-top: 48px;
          display: flex; flex-wrap: wrap;
          align-items: center; justify-content: space-between;
          gap: 16px;
          font-size: 12px;
          color: var(--landing-muted);
        }
        .landing-footrow nav a:hover { color: var(--landing-ink); }
      `}</style>

      <LandingNav />
      <main>
        <Hero stat={safeStat} />
        <div id="pulse">
          <LivePulse stat={safeStat} />
        </div>
        <div id="how">
          <HowItWorks />
        </div>
      </main>
      <LandingFooter />
    </div>
  );
}
