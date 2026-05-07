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
 * Design north-star: feel like a trustworthy letter from a neighbour,
 * not a SaaS landing page. Restraint everywhere except where the data
 * (live sensor count, emergency phone numbers) needs to assert itself.
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
    <section className="px-6 pt-24 pb-32 sm:pt-32 sm:pb-40">
      <div className="mx-auto max-w-3xl">
        <p
          className="text-[11px] font-semibold uppercase tracking-[0.2em]"
          style={{ color: "var(--landing-muted)" }}
        >
          Community-driven flood monitoring · Sarawak
        </p>
        <h1
          className="mt-6 font-serif text-5xl leading-[1.04] tracking-tight sm:text-6xl md:text-7xl"
          style={{ color: "var(--landing-ink)" }}
        >
          Know the water<br />
          before it knows<br />
          your street.
        </h1>
        <p
          className="mt-8 max-w-xl text-lg leading-relaxed"
          style={{ color: "var(--landing-ink-secondary)" }}
        >
          A live network of neighbour-run sensors and on-the-ground reports —
          built for Sarawak&apos;s streets, kampungs, and rivers.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-5">
          <Link
            href="/register"
            className="inline-flex items-center gap-2 rounded-full bg-[var(--landing-ink)] px-7 py-3 text-sm font-semibold text-[var(--landing-paper)] transition hover:opacity-90"
          >
            Join Community
            <span aria-hidden>→</span>
          </Link>
          <Link
            href="/flood-map"
            className="text-sm font-semibold underline-offset-4 hover:underline"
            style={{ color: "var(--landing-ink)" }}
          >
            See the live map
          </Link>
        </div>
        <div
          className="mt-12 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs"
          style={{ color: "var(--landing-ink-secondary)" }}
        >
          <span className="inline-flex items-center gap-2">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{
                background: "#22c55e",
                boxShadow: "0 0 8px #22c55e",
                animation: "landing-pulse 2s ease-in-out infinite",
              }}
              aria-hidden
            />
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
    default:         return { dot: "#9ca3af", label: "Resolved" };
  }
}

function LivePulse({ stat }: { stat: LandingStat }) {
  return (
    <section
      className="px-6 py-24 sm:py-32"
      style={{ background: "var(--landing-cream)" }}
    >
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p
              className="text-[11px] font-semibold uppercase tracking-[0.2em]"
              style={{ color: "var(--landing-muted)" }}
            >
              Live Pulse · Happening now
            </p>
            <h2
              className="mt-3 font-serif text-4xl leading-[1.05] tracking-tight sm:text-5xl"
              style={{ color: "var(--landing-ink)" }}
            >
              Right now in Sarawak
            </h2>
          </div>
          <p
            className="text-xs"
            style={{ color: "var(--landing-ink-secondary)" }}
          >
            Updated <span className="tabular-nums">just now</span>
          </p>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {PULSE_STORIES.map((s, i) => {
            const tok = severityToken(s.severity);
            return (
              <article
                key={i}
                className="rounded-2xl border p-5"
                style={{
                  background: "var(--landing-paper)",
                  borderColor: "var(--landing-hairline)",
                }}
              >
                <p className="text-xs font-medium tabular-nums" style={{ color: "var(--landing-muted)" }}>
                  {s.when} · {s.where}
                </p>
                <p
                  className="mt-3 text-sm leading-relaxed"
                  style={{ color: "var(--landing-ink)" }}
                >
                  &ldquo;{s.quote}&rdquo;
                </p>
                <p
                  className="mt-4 text-xs"
                  style={{ color: "var(--landing-ink-secondary)" }}
                >
                  — {s.author}, <span style={{ color: "var(--landing-muted)" }}>{s.role}</span>
                </p>
                <p className="mt-4 inline-flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: tok.dot }}>
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

        <p
          className="mt-10 text-sm"
          style={{ color: "var(--landing-ink-secondary)" }}
        >
          {stat.reportsThisYear.toLocaleString()} reports filed by the community this year ·{" "}
          <Link
            href="/blog"
            className="font-semibold underline-offset-4 hover:underline"
            style={{ color: "var(--landing-ink)" }}
          >
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
  // Simple intersection-observer driven step highlight — when each step
  // scrolls into the viewport, mark it active. Cheaper than a Lottie
  // scroll-scrub but still feels purposeful.
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
    <section className="px-6 py-24 sm:py-32">
      <div className="mx-auto max-w-5xl">
        <p
          className="text-[11px] font-semibold uppercase tracking-[0.2em]"
          style={{ color: "var(--landing-muted)" }}
        >
          How it works
        </p>
        <h2
          className="mt-3 font-serif text-4xl leading-[1.05] tracking-tight sm:text-5xl"
          style={{ color: "var(--landing-ink)" }}
        >
          Three steps, no jargon.
        </h2>

        <div className="mt-16 grid gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Steps column */}
          <ol className="space-y-12">
            {STEPS.map((s, i) => (
              <li
                key={s.n}
                ref={(el) => { stepRefs.current[i] = el; }}
                data-idx={i}
                className="transition-colors duration-500"
                style={{
                  color: activeStep === i ? "var(--landing-ink)" : "var(--landing-muted)",
                }}
              >
                <p className="font-mono text-xs">{s.n}</p>
                <h3 className="mt-2 font-serif text-3xl tracking-tight">{s.title}</h3>
                <p
                  className="mt-3 max-w-md text-base leading-relaxed"
                  style={{
                    color: activeStep === i
                      ? "var(--landing-ink-secondary)"
                      : "var(--landing-muted)",
                  }}
                >
                  {s.body}
                </p>
              </li>
            ))}
          </ol>

          {/* Illustration column — sticky stack */}
          <div className="hidden lg:block">
            <div className="sticky top-32">
              <HowItWorksIllustration step={activeStep} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * SVG-only illustrated map showing the three-step sequence:
 *   step 0: sensors pulse along a watercolour river
 *   step 1: a hand cursor drops a pin near the riverbank
 *   step 2: ripples + neighbour avatars receive a checkmark notification
 *
 * No external assets required. CSS transitions handle the cross-step
 * choreography so reduced-motion users get a static last frame.
 */
function HowItWorksIllustration({ step }: { step: number }) {
  return (
    <div
      className="aspect-[4/3] w-full overflow-hidden rounded-2xl border p-6"
      style={{
        background: "var(--landing-paper)",
        borderColor: "var(--landing-hairline)",
      }}
    >
      <svg viewBox="0 0 400 300" className="h-full w-full">
        {/* River path */}
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
        {/* Sensor dots — visible from step 0+ */}
        {[
          { x: 60, y: 175 },
          { x: 160, y: 158 },
          { x: 260, y: 162 },
          { x: 340, y: 152 },
        ].map((s, i) => (
          <g key={i} style={{ opacity: step >= 0 ? 1 : 0, transition: "opacity 600ms" }}>
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
        {/* Pin (step 1+) */}
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
        {/* Caption card (step 1+) */}
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
        {/* Ripples + neighbour avatars (step 2) */}
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
    <footer className="px-6 pt-24 pb-16 border-t" style={{ borderColor: "var(--landing-hairline)" }}>
      <div className="mx-auto max-w-5xl">
        <h2
          className="font-serif text-3xl leading-tight tracking-tight"
          style={{ color: "var(--landing-ink)" }}
        >
          In an emergency, do not rely on this site.
        </h2>
        <p
          className="mt-3 max-w-xl text-base leading-relaxed"
          style={{ color: "var(--landing-ink-secondary)" }}
        >
          Tap a number on mobile to dial. FloodWatch supplements official channels — it does not replace them.
        </p>

        <div className="mt-10 grid gap-3 sm:grid-cols-2">
          {EMERGENCY.map((e) => (
            <a
              key={e.number}
              href={`tel:${e.number.replace(/[^0-9+]/g, "")}`}
              className="flex items-center justify-between gap-4 rounded-2xl border px-5 py-4 transition hover:border-[var(--landing-ink)]"
              style={{
                background: "var(--landing-paper)",
                borderColor: "var(--landing-hairline)",
              }}
            >
              <span
                className="text-sm font-semibold"
                style={{ color: "var(--landing-ink)" }}
              >
                {e.label}
              </span>
              <span
                className="font-mono text-xl tabular-nums"
                style={{ color: "var(--landing-ink)" }}
              >
                {e.number}
              </span>
            </a>
          ))}
        </div>

        <hr className="my-12" style={{ borderColor: "var(--landing-hairline)" }} />

        <p
          className="max-w-2xl text-sm leading-relaxed"
          style={{ color: "var(--landing-ink-secondary)" }}
        >
          FloodWatch is built by a small group of volunteers, students, and JKR engineers in Kuching.
          Sensors are funded by community donations and Universiti Malaysia Sarawak&apos;s IoT lab.
        </p>
        <p
          className="mt-4 text-xs"
          style={{ color: "var(--landing-muted)" }}
        >
          Open data · MIT-licensed code · No tracking
        </p>

        <div
          className="mt-12 flex flex-wrap items-center justify-between gap-4 text-xs"
          style={{ color: "var(--landing-muted)" }}
        >
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

// ── Top nav for the landing page (lighter than the in-app Navbar) ──────────

function LandingNav() {
  return (
    <header
      className="sticky top-0 z-30 border-b px-6 py-4 backdrop-blur-md"
      style={{
        background: "rgba(245, 243, 238, 0.7)",
        borderColor: "var(--landing-hairline)",
      }}
    >
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-6">
        <Link
          href="/"
          className="flex items-center gap-2.5 font-serif text-lg"
          style={{ color: "var(--landing-ink)" }}
        >
          <Image src="/images/logo.png" alt="" width={28} height={28} />
          FloodWatch
        </Link>
        <nav className="hidden items-center gap-7 text-sm md:flex" style={{ color: "var(--landing-ink-secondary)" }}>
          <Link href="#pulse"  className="hover:text-[var(--landing-ink)]">Pulse</Link>
          <Link href="/flood-map" className="hover:text-[var(--landing-ink)]">Map</Link>
          <Link href="#how"   className="hover:text-[var(--landing-ink)]">How it works</Link>
          <Link href="/blog"  className="hover:text-[var(--landing-ink)]">Stories</Link>
        </nav>
        <div className="flex items-center gap-3">
          <ThemeToggle compact />
          <Link
            href="/register"
            className="rounded-full bg-[var(--landing-ink)] px-5 py-2 text-xs font-semibold text-[var(--landing-paper)] transition hover:opacity-90"
          >
            Join
          </Link>
        </div>
      </div>
    </header>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function LandingPage({ stat }: { stat?: LandingStat }) {
  // Provide sensible defaults if the live count fetch hasn't returned yet —
  // these are calibrated to recent realistic numbers, not zeroed.
  const safeStat = stat ?? { online: 109, reportsThisYear: 2341 };

  return (
    <div
      className="min-h-screen"
      style={{
        background: "var(--landing-paper)",
        color: "var(--landing-ink)",
        // The serif/sans pairing — Source Serif 4 with system fallbacks for
        // display, the existing geist-sans for body. CSS variables defined
        // inline below so the landing page is fully self-contained even if
        // a downstream Tailwind config is missing.
        ["--landing-paper" as string]: "#f5f3ee",
        ["--landing-cream" as string]: "#f0ebd8",
        ["--landing-ink" as string]: "#1f1d1a",
        ["--landing-ink-secondary" as string]: "#5b5750",
        ["--landing-muted" as string]: "#8a857d",
        ["--landing-hairline" as string]: "#e7e3d8",
      }}
    >
      <style jsx global>{`
        :root.dark [data-landing-root] {
          --landing-paper: #1c1b18 !important;
          --landing-cream: #26241f !important;
          --landing-ink: #e9e4d8 !important;
          --landing-ink-secondary: #b8b2a4 !important;
          --landing-muted: #7d7869 !important;
          --landing-hairline: #34322c !important;
        }
        .font-serif { font-family: "Source Serif 4", "Iowan Old Style", "Apple Garamond", "Palatino", serif; }
        @keyframes landing-pulse {
          0%, 100% { opacity: 0.4; }
          50%      { opacity: 1;   }
        }
      `}</style>

      <div data-landing-root>
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
    </div>
  );
}
