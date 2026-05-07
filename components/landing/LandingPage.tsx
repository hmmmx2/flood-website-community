"use client";

/**
 * Public landing page rendered at "/" for unauthenticated visitors.
 *
 * Visual system: re-uses the shared design tokens from
 * lib/theme/tokens.css (--color-bg / --color-card / --color-brand /
 * --gradient-hero) so the page feels like part of the same product as
 * the community feed, the CRM, and the mobile app. Logged-in users
 * continue to fall through to the existing community feed (the parent
 * HomePage only renders this component when sessionStatus !==
 * 'loading' && !session).
 *
 * Audience: Malaysian residents (the "join the network" path) AND
 * NGOs / investors / funders (the "fund this" path). Both share the
 * hero, then split at the "Get involved" section into a community
 * track (Join / Volunteer) and a funder track (Donate / Partner /
 * Sponsor a node).
 */

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ThemeToggle } from "@/lib/theme/ThemeToggle";

// ── Types ──────────────────────────────────────────────────────────────────

type LandingStat = {
  online: number;
  reportsThisYear: number;
  statesCovered: number;
  livesReached: number;
};

// ── Animated counter (count-up on first viewport entry) ────────────────────

function useCountUp(target: number, durationMs = 1200) {
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLSpanElement | null>(null);
  const triggered = useRef(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && !triggered.current) {
            triggered.current = true;
            const start = performance.now();
            const tick = (t: number) => {
              const p = Math.min(1, (t - start) / durationMs);
              const eased = 1 - Math.pow(1 - p, 3);
              setValue(Math.round(target * eased));
              if (p < 1) requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
          }
        }
      },
      { threshold: 0.4 },
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, [target, durationMs]);

  return { value, ref };
}

function CountUp({ to, suffix = "", className }: { to: number; suffix?: string; className?: string }) {
  const { value, ref } = useCountUp(to);
  return (
    <span ref={ref} className={className}>
      {value.toLocaleString()}
      {suffix}
    </span>
  );
}

// ── Top nav ────────────────────────────────────────────────────────────────

function LandingNav() {
  return (
    <header className="landing-nav">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-4">
        <Link href="/" className="landing-brand">
          <Image src="/images/logo.png" alt="" width={28} height={28} priority />
          <span>FloodWatch</span>
        </Link>
        <nav className="landing-nav-links hidden items-center gap-7 text-sm md:flex">
          <Link href="#impact">Impact</Link>
          <Link href="#how">How it works</Link>
          <Link href="#fund">Fund this</Link>
          <Link href="/flood-map">Live map</Link>
          <Link href="/blog">Stories</Link>
        </nav>
        <div className="flex items-center gap-3">
          <ThemeToggle compact />
          <Link href="#fund" className="landing-nav-donate hidden sm:inline-flex">
            Donate
          </Link>
          <Link href="/register" className="landing-nav-cta">
            Join
          </Link>
        </div>
      </div>
    </header>
  );
}

// ── Hero ───────────────────────────────────────────────────────────────────

function Hero({ stat }: { stat: LandingStat }) {
  return (
    <section className="landing-hero">
      <div aria-hidden className="landing-hero-grid" />
      <div aria-hidden className="landing-hero-glow" />
      <div className="relative mx-auto max-w-5xl px-6 pt-24 pb-28 sm:pt-32 sm:pb-36">
        <div className="landing-hero-eyebrow">
          <span className="landing-pulsedot" aria-hidden />
          Community-driven flood monitoring · Malaysia
        </div>
        <h1 className="landing-h1">
          Know the water<br />
          before it knows<br />
          your street.
        </h1>
        <p className="landing-lede">
          A nationwide network of community-run sensors and on-the-ground reports —
          covering rivers across Malaysia, from Sungai Kelantan to Sungai Sarawak.
          Real-time alerts. Open data. Built by neighbours, for neighbours.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-x-5 gap-y-3">
          <Link href="/register" className="landing-cta-primary">
            Join the Network
            <span aria-hidden>→</span>
          </Link>
          <Link href="#fund" className="landing-cta-secondary">
            Fund this project
          </Link>
        </div>
        <div className="landing-trustrow">
          <span className="inline-flex items-center gap-2">
            <span className="landing-pulsedot landing-pulsedot--green" aria-hidden />
            Live · {stat.online.toLocaleString()} sensors online
          </span>
          <span aria-hidden>·</span>
          <span>{stat.statesCovered} states covered</span>
          <span aria-hidden>·</span>
          <span>{stat.reportsThisYear.toLocaleString()} community reports this year</span>
        </div>
      </div>
    </section>
  );
}

// ── Impact stats ───────────────────────────────────────────────────────────

function ImpactStats({ stat }: { stat: LandingStat }) {
  const items: { label: string; value: number; suffix?: string; tag: string }[] = [
    { label: "Sensors deployed",      value: stat.online,            tag: "live" },
    { label: "Malaysian states covered", value: stat.statesCovered,  tag: "coverage" },
    { label: "Reports filed in 2026",   value: stat.reportsThisYear, tag: "community" },
    { label: "Residents served",        value: stat.livesReached,    suffix: "+", tag: "impact" },
  ];
  return (
    <section id="impact" className="landing-section landing-section--alt">
      <div className="mx-auto max-w-6xl px-6 py-24 sm:py-28">
        <p className="landing-eyebrow">Our impact</p>
        <h2 className="landing-h2 mt-3">A national network — built in 18 months.</h2>
        <p className="landing-section-lede">
          What started as four sensors on the Sungai Sarawak in late 2024 has
          grown into Malaysia&apos;s first community-operated flood-warning
          mesh. Every metric below is updated live from the same database
          your alerts come from.
        </p>
        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((it, i) => (
            <div key={i} className="landing-statcard">
              <p className="landing-stat-tag">{it.tag}</p>
              <p className="landing-stat-value">
                <CountUp to={it.value} suffix={it.suffix ?? ""} />
              </p>
              <p className="landing-stat-label">{it.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Live Pulse ─────────────────────────────────────────────────────────────

const PULSE_STORIES = [
  {
    when: "02:14 AM",
    where: "Sungai Kelantan · Kota Bharu",
    quote:
      "Water rising fast near Pasar Siti Khadijah. Headed inland, families in Kampung Laut please prepare.",
    author: "Mei Lin",
    role: "Resident · Kelantan",
    severity: "warning" as const,
  },
  {
    when: "01:47 AM",
    where: "Jalan Tun Razak · Kuala Lumpur",
    quote:
      "Road impassable past Sungai Klang underpass — two cars stuck. Use AKLEH instead.",
    author: "Faizal",
    role: "NGO Volunteer · Selangor",
    severity: "critical" as const,
  },
  {
    when: "12:30 AM",
    where: "Sungai Sarawak · Kuching",
    quote: "All clear after the morning. Drains have been cleared by JPS Sarawak crews.",
    author: "Datuk Khairul",
    role: "Coordinator · Sarawak",
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
    <section className="landing-section">
      <div className="mx-auto max-w-6xl px-6 py-24 sm:py-28">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="landing-eyebrow">Live Pulse · Happening now</p>
            <h2 className="landing-h2 mt-3">Right now across Malaysia</h2>
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
                  <span className="inline-block h-2 w-2 rounded-full" style={{ background: tok.dot }} aria-hidden />
                  {tok.label}
                </p>
              </article>
            );
          })}
        </div>

        <p className="mt-12 landing-meta">
          {stat.reportsThisYear.toLocaleString()} reports filed nationwide this year ·{" "}
          <Link href="/blog" className="landing-link">
            Read the stories →
          </Link>
        </p>
      </div>
    </section>
  );
}

// ── How It Works ───────────────────────────────────────────────────────────
//
// Cleve.ai-inspired section pattern: one "feature row" per step, alternating
// text-left/visual-right and visual-left/text-right. Each visual is a
// glass-morphism card stack rendered over the flood background image with
// a heavy vignette, so it reads as a real product preview rather than a
// stylised illustration.

function FeatureRow({
  reverse = false,
  eyebrow,
  title,
  body,
  visual,
}: {
  reverse?: boolean;
  eyebrow: string;
  title: React.ReactNode;
  body: string;
  visual: React.ReactNode;
}) {
  return (
    <div
      className={`landing-feature ${reverse ? "is-reverse" : ""}`}
    >
      <div className="landing-feature-text">
        <p className="landing-eyebrow">{eyebrow}</p>
        <h3 className="landing-feature-title">{title}</h3>
        <p className="landing-feature-body">{body}</p>
      </div>
      <div className="landing-feature-visual">{visual}</div>
    </div>
  );
}

/** Glass card stack showing live sensor telemetry — feature 01 (Sense). */
function SenseVisual() {
  const SAMPLE = [
    { id: "102509075", river: "Sungai Sarawak · Kuching",   level: 3, lvLabel: "3 ft", sev: "CRITICAL" as const, ago: "12s ago" },
    { id: "102503180", river: "Sungai Klang · Kuala Lumpur", level: 2, lvLabel: "2 ft", sev: "WARNING"  as const, ago: "24s ago" },
    { id: "102782478", river: "Sungai Pahang · Kuantan",     level: 1, lvLabel: "1 ft", sev: "ALERT"    as const, ago: "33s ago" },
  ];
  const sevColor = { CRITICAL: "#dc2626", WARNING: "#f97316", ALERT: "#f59e0b" };
  return (
    <FeatureFrame>
      <div className="landing-glass">
        <div className="landing-glass-head">
          <span className="landing-glass-headlabel">Live telemetry</span>
          <span className="landing-glass-pulse" aria-hidden />
        </div>
        <div className="flex flex-col gap-2">
          {SAMPLE.map((s) => (
            <div key={s.id} className="landing-sensor-row">
              <div className="min-w-0 flex-1">
                <p className="landing-sensor-id">Node {s.id}</p>
                <p className="landing-sensor-river">{s.river}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="landing-sensor-level">{s.lvLabel}</span>
                <span
                  className="landing-sensor-pill"
                  style={{ background: `${sevColor[s.sev]}22`, color: sevColor[s.sev], borderColor: `${sevColor[s.sev]}55` }}
                >
                  <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: sevColor[s.sev] }} aria-hidden />
                  {s.sev}
                </span>
              </div>
              <span className="landing-sensor-ago">{s.ago}</span>
            </div>
          ))}
        </div>
        <p className="landing-glass-foot">
          <span className="landing-pulsedot landing-pulsedot--green" aria-hidden /> 109 sensors · pinging every 60s
        </p>
      </div>
    </FeatureFrame>
  );
}

/** Mock community report compose UI — feature 02 (Report). */
function ReportVisual() {
  return (
    <FeatureFrame>
      <div className="landing-glass">
        <div className="landing-glass-head">
          <span className="landing-glass-headlabel">New community report</span>
          <span className="landing-glass-step">Step 2 of 3</span>
        </div>
        <div className="flex flex-col gap-3">
          <div className="landing-report-field">
            <span className="landing-report-icon" aria-hidden>📍</span>
            <span className="landing-report-text">Sungai Klang · KFC junction underpass</span>
          </div>
          <div className="landing-report-field is-textarea">
            <span className="landing-report-icon" aria-hidden>💬</span>
            <span className="landing-report-text">
              Road impassable past underpass — two cars stuck. Use AKLEH instead.
              Water rising fast, please share with anyone in the area.
            </span>
          </div>
          <div className="landing-report-field">
            <span className="landing-report-icon" aria-hidden>📷</span>
            <span className="landing-report-text landing-report-text--muted">Photo attached · IMG_4421.jpg</span>
            <span className="landing-report-thumb" aria-hidden />
          </div>
        </div>
        <button className="landing-report-send" type="button">
          Send report
          <span aria-hidden>→</span>
        </button>
      </div>
    </FeatureFrame>
  );
}

/** Stacked notification toast preview — feature 03 (Alert). */
function AlertVisual() {
  const ALERTS = [
    { sev: "CRITICAL" as const, river: "Sungai Sarawak · Kuching",  level: "4.2 ft", ago: "2s ago" },
    { sev: "WARNING"  as const, river: "Sungai Kelantan · Kota Bharu", level: "2.4 ft", ago: "47s ago" },
    { sev: "ALERT"    as const, river: "Sungai Pahang · Kuantan",   level: "1.1 ft", ago: "1m ago" },
  ];
  const sevTone = {
    CRITICAL: { bg: "linear-gradient(135deg, #450a0a, #7f1d1d 60%, #b91c1c)", line: "#dc2626" },
    WARNING:  { bg: "linear-gradient(135deg, #431407, #9a3412 60%, #ea580c)", line: "#f97316" },
    ALERT:    { bg: "linear-gradient(135deg, #451a03, #92400e 60%, #d97706)", line: "#f59e0b" },
  };
  return (
    <FeatureFrame>
      <div className="landing-glass landing-glass--alerts">
        <div className="landing-glass-head landing-glass-head--alert">
          <span className="landing-glass-pulse" aria-hidden />
          <span className="landing-glass-headlabel">3 ACTIVE FLOOD ALERTS</span>
          <span className="landing-glass-dismiss">Dismiss all</span>
        </div>
        <div className="flex flex-col gap-2.5">
          {ALERTS.map((a, i) => {
            const t = sevTone[a.sev];
            return (
              <div
                key={i}
                className="landing-toast"
                style={{ background: t.bg, borderColor: t.line }}
              >
                <span className="landing-toast-strip" style={{ background: t.line }} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="landing-toast-eyebrow">Flood Advisory · {a.sev[0] + a.sev.slice(1).toLowerCase()}</p>
                  <p className="landing-toast-title">{a.river}</p>
                  <p className="landing-toast-meta">
                    Water level <span className="font-bold">{a.level}</span>
                  </p>
                  <div className="landing-toast-footer">
                    <span className="font-bold underline-offset-2 underline">View live map →</span>
                    <span className="tabular-nums opacity-90">{a.ago}</span>
                  </div>
                </div>
                <span className="landing-toast-close" aria-hidden>✕</span>
              </div>
            );
          })}
        </div>
      </div>
    </FeatureFrame>
  );
}

/** Photo-backed glass-card frame — shared by all three feature visuals. */
function FeatureFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="landing-feature-frame">
      <div aria-hidden className="landing-feature-photo" />
      <div aria-hidden className="landing-feature-vignette" />
      <div className="relative">{children}</div>
    </div>
  );
}

function HowItWorks() {
  return (
    <section id="how" className="landing-section">
      <div className="mx-auto max-w-6xl px-6 py-28 sm:py-36">
        <div className="max-w-2xl">
          <p className="landing-eyebrow">How it works</p>
          <h2 className="landing-h2 mt-3">From a sensor in a river to a phone in a hand.</h2>
          <p className="landing-section-lede mt-6">
            Three loops working together every minute, every day, across Malaysia&apos;s
            13 states and 3 federal territories.
          </p>
        </div>

        <div className="mt-20 flex flex-col gap-28">
          <FeatureRow
            eyebrow="01 · Sense"
            title={<>Sensors that <span className="landing-h2-accent">don&apos;t sleep</span>.</>}
            body="Solar-powered IoT nodes along Malaysia's major rivers ping water level every 60 seconds. The raw telemetry streams straight into our open Postgres database — no middleman, no rate limits, no vendor lock-in."
            visual={<SenseVisual />}
          />
          <FeatureRow
            reverse
            eyebrow="02 · Report"
            title={<>Anyone can report. <span className="landing-h2-accent">Instantly</span>.</>}
            body="Sensors miss things people don't — a blocked drain, a road that's impassable, a kampung cut off. Tap a location on the map, snap one photo, write one line. The report fans out to neighbours within minutes."
            visual={<ReportVisual />}
          />
          <FeatureRow
            eyebrow="03 · Alert"
            title={<>Sub-second alerts to <span className="landing-h2-accent">every device</span>.</>}
            body="When a sensor crosses 1 ft, an alert reaches every subscribed resident, NGO, and emergency contact in under a second — push, email, SMS, and in-app toast. Tested up to 50,000 concurrent recipients."
            visual={<AlertVisual />}
          />
        </div>
      </div>
    </section>
  );
}

// ── Why fund this — investor / NGO appeal ──────────────────────────────────

const FUND_REASONS = [
  {
    icon: "🌊",
    title: "Open infrastructure",
    body:
      "Every sensor reading and community report is published as open data under a permissive licence. Researchers, NGOs, and government agencies can build on top — no gatekeeping.",
  },
  {
    icon: "👥",
    title: "Run by neighbours",
    body:
      "Sensors are hosted, maintained, and monitored by the communities they protect. We pay residents a small stipend for upkeep — your funding goes into Malaysian hands.",
  },
  {
    icon: "⚡",
    title: "Sub-second alerts",
    body:
      "When a sensor crosses 1 ft, an alert reaches every subscribed resident, NGO, and emergency contact in under a second — via push, email, and SMS.",
  },
] as const;

const FUND_TIERS = [
  {
    label: "Sponsor a sensor",
    amount: "RM 600",
    cadence: "one-time",
    body: "Hardware + 12 months of cellular data + stipend for the local maintainer.",
    highlight: false,
  },
  {
    label: "Adopt a node",
    amount: "RM 50",
    cadence: "per month",
    body: "Recurring funding lets us deploy without having to fundraise per device. Recommended.",
    highlight: true,
  },
  {
    label: "Partner / Grant",
    amount: "Custom",
    cadence: "let's talk",
    body: "Universities, NGOs, agencies, and corporations — let's co-design coverage in your region.",
    highlight: false,
  },
] as const;

function WhyFundThis() {
  return (
    <section id="fund" className="landing-section">
      <div className="mx-auto max-w-6xl px-6 py-24 sm:py-32">
        <div className="max-w-3xl">
          <p className="landing-eyebrow">Why fund FloodWatch</p>
          <h2 className="landing-h2 mt-3">
            For the cost of one rescue boat, we can warn{" "}
            <span className="landing-h2-accent">a thousand families</span>.
          </h2>
          <p className="landing-section-lede mt-6">
            Malaysia spends RM 1.2 billion a year on flood damage. A single
            community sensor costs RM 600 and protects an average of 240
            residents in its zone. That&apos;s sub-RM 3 per resident-year —
            the cheapest early-warning infrastructure in the region.
          </p>
        </div>

        <div className="mt-14 grid gap-4 lg:grid-cols-3">
          {FUND_REASONS.map((r) => (
            <div key={r.title} className="landing-fundcard">
              <div className="landing-fund-icon" aria-hidden>{r.icon}</div>
              <h3 className="landing-fund-title">{r.title}</h3>
              <p className="landing-fund-body">{r.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-16 grid gap-4 lg:grid-cols-3">
          {FUND_TIERS.map((t) => (
            <div
              key={t.label}
              className={`landing-tier ${t.highlight ? "landing-tier--highlight" : ""}`}
            >
              {t.highlight && <span className="landing-tier-badge">Most impact</span>}
              <p className="landing-tier-label">{t.label}</p>
              <p className="landing-tier-amount">
                {t.amount}
                <span className="landing-tier-cadence">/ {t.cadence}</span>
              </p>
              <p className="landing-tier-body">{t.body}</p>
              <Link href="mailto:partners@floodwatch.my" className="landing-tier-cta">
                {t.highlight ? "Set up monthly →" : t.label === "Partner / Grant" ? "Get in touch →" : "Sponsor now →"}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Get involved tracks (community vs funder) ──────────────────────────────

function GetInvolved() {
  return (
    <section className="landing-section landing-section--alt">
      <div className="mx-auto max-w-6xl px-6 py-24 sm:py-28">
        <p className="landing-eyebrow">Get involved</p>
        <h2 className="landing-h2 mt-3">There&apos;s a way for everyone.</h2>

        <div className="mt-12 grid gap-4 lg:grid-cols-3">
          <article className="landing-pathcard">
            <p className="landing-path-tag">Residents</p>
            <h3 className="landing-path-title">Get the alerts.</h3>
            <p className="landing-path-body">
              Sign up for free and start receiving real-time flood warnings
              for your area — push notification, email, or both.
            </p>
            <Link href="/register" className="landing-path-cta">
              Join the network →
            </Link>
          </article>

          <article className="landing-pathcard">
            <p className="landing-path-tag">Volunteers</p>
            <h3 className="landing-path-title">Help us build it.</h3>
            <p className="landing-path-body">
              We&apos;re always short on field technicians, developers, translators
              (BM / Iban / Mandarin / Tamil), and outreach coordinators.
            </p>
            <Link href="mailto:volunteer@floodwatch.my" className="landing-path-cta">
              Volunteer with us →
            </Link>
          </article>

          <article className="landing-pathcard">
            <p className="landing-path-tag">NGOs · Agencies · Funders</p>
            <h3 className="landing-path-title">Co-deploy in your region.</h3>
            <p className="landing-path-body">
              We partner with NGOs, JPS state offices, universities, and
              corporate-sustainability programs to deploy in priority zones.
            </p>
            <Link href="mailto:partners@floodwatch.my" className="landing-path-cta">
              Talk to our team →
            </Link>
          </article>
        </div>
      </div>
    </section>
  );
}

// ── Partners / supporters strip ────────────────────────────────────────────

const PARTNERS = [
  "Universiti Malaysia Sarawak",
  "Universiti Malaya",
  "JPS Malaysia",
  "JBPM Bomba",
  "Mercy Malaysia",
  "MyDigital",
];

function Partners() {
  return (
    <section className="landing-section">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <p className="landing-eyebrow text-center">Supported by</p>
        <ul className="landing-partners">
          {PARTNERS.map((p) => (
            <li key={p} className="landing-partner">{p}</li>
          ))}
        </ul>
        <p className="landing-partners-note">
          A non-exhaustive list — we&apos;re continuously onboarding new partners
          across Malaysia&apos;s state JPS offices, universities, and disaster-
          response NGOs.
        </p>
      </div>
    </section>
  );
}

// ── Footer with emergency contacts ─────────────────────────────────────────

const EMERGENCY = [
  { label: "Bomba (Fire & Rescue)", number: "994" },
  { label: "Civil Defence (APM)",   number: "991" },
  { label: "Police",                number: "999" },
  { label: "JPS Flood Hotline",     number: "1800-88-2773" },
];

function LandingFooter() {
  return (
    <footer className="landing-footer">
      <div className="mx-auto max-w-6xl px-6 pt-24 pb-16">
        <h2 className="landing-footer-h2">
          In an emergency, do not rely on this site.
        </h2>
        <p className="landing-footer-lede">
          Tap a number on mobile to dial. FloodWatch supplements official
          channels — it does not replace them.
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
          FloodWatch is built and operated by volunteers, students, and
          engineers across Malaysia, in partnership with state JPS offices,
          Bomba, and university research labs. Sensors are funded by community
          donations, NGO grants, and corporate-sustainability programs.
        </p>
        <p className="landing-tag">
          Open data · MIT-licensed code · No tracking · Made in Malaysia
        </p>

        <div className="landing-footrow">
          <div className="flex items-center gap-2">
            <Image src="/images/logo.png" alt="FloodWatch" width={20} height={20} />
            <span>FloodWatch · © 2026</span>
          </div>
          <nav className="flex flex-wrap gap-x-5 gap-y-1">
            <Link href="/login">Log in</Link>
            <Link href="/blog">Blog</Link>
            <Link href="/flood-map">Map</Link>
            <Link href="mailto:partners@floodwatch.my">Contact</Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function LandingPage({ stat }: { stat?: LandingStat }) {
  const safeStat: LandingStat = stat ?? {
    online: 109,
    reportsThisYear: 2341,
    statesCovered: 13,
    livesReached: 26000,
  };

  return (
    <div data-landing-root className="landing-root">
      <style jsx global>{`
        /* ── The landing page sits on top of the same design tokens as the
              community feed and CRM (lib/theme/tokens.css), so the visual
              system stays consistent across the entire product. We layer
              a few landing-only accents on top — nothing that conflicts. */
        [data-landing-root] {
          background: var(--color-bg);
          color: var(--color-text);
          font-family: var(--font-geist-sans, "Inter Tight"), system-ui, sans-serif;
        }

        /* Typography */
        .landing-eyebrow {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: var(--color-brand-soft, #388bfd);
        }
        .landing-h1 {
          margin-top: 24px;
          font-size: clamp(48px, 7vw, 84px);
          line-height: 1.02;
          letter-spacing: -0.025em;
          font-weight: 600;
          color: var(--color-text);
        }
        .landing-h2 {
          font-size: clamp(32px, 4.4vw, 52px);
          line-height: 1.05;
          letter-spacing: -0.02em;
          font-weight: 600;
          color: var(--color-text);
        }
        .landing-h2-accent {
          background: var(--gradient-hero, linear-gradient(135deg, #1f3a6e, #1f6feb));
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          color: transparent;
        }
        .landing-lede {
          margin-top: 28px;
          max-width: 38rem;
          font-size: 18px;
          line-height: 1.65;
          color: var(--color-text-secondary);
        }
        .landing-section-lede {
          margin-top: 18px;
          max-width: 42rem;
          font-size: 16px;
          line-height: 1.65;
          color: var(--color-text-secondary);
        }
        .landing-meta {
          font-size: 14px;
          color: var(--color-muted);
        }
        .landing-link {
          font-weight: 600;
          color: var(--color-brand-soft, #388bfd);
          text-decoration: underline;
          text-underline-offset: 4px;
          text-decoration-color: rgba(56, 139, 253, 0.4);
        }
        .landing-link:hover { text-decoration-color: var(--color-brand-soft, #388bfd); }

        /* Section frames */
        .landing-section { background: var(--color-bg); }
        .landing-section--alt {
          background: linear-gradient(180deg,
            var(--color-bg) 0%,
            color-mix(in srgb, var(--color-card) 60%, var(--color-bg)) 100%);
          border-top: 1px solid var(--color-border);
          border-bottom: 1px solid var(--color-border);
        }

        /* Nav */
        .landing-nav {
          position: sticky; top: 0; z-index: 30;
          backdrop-filter: blur(14px) saturate(140%);
          -webkit-backdrop-filter: blur(14px) saturate(140%);
          background: color-mix(in srgb, var(--color-bg) 75%, transparent);
          border-bottom: 1px solid var(--color-border);
        }
        .landing-brand {
          display: flex; align-items: center; gap: 10px;
          font-size: 17px; font-weight: 600;
          letter-spacing: -0.01em;
          color: var(--color-text);
        }
        .landing-nav-links a {
          color: var(--color-text-secondary);
          font-size: 14px;
          transition: color 160ms ease;
        }
        .landing-nav-links a:hover { color: var(--color-text); }
        .landing-nav-donate {
          display: inline-flex; align-items: center;
          padding: 7px 16px;
          border-radius: 999px;
          border: 1px solid var(--color-border);
          color: var(--color-text);
          font-size: 13px; font-weight: 600;
          transition: border-color 160ms ease, background 160ms ease;
        }
        .landing-nav-donate:hover {
          border-color: var(--color-brand-soft, #388bfd);
          background: var(--color-hover);
        }
        .landing-nav-cta {
          display: inline-flex; align-items: center;
          padding: 8px 18px;
          border-radius: 999px;
          background: var(--color-brand);
          color: #fff;
          font-size: 13px; font-weight: 600;
          transition: opacity 160ms ease;
        }
        .landing-nav-cta:hover { opacity: 0.9; }

        /* Hero */
        .landing-hero {
          position: relative;
          overflow: hidden;
        }
        .landing-hero-grid {
          position: absolute; inset: 0;
          background-image:
            linear-gradient(var(--color-border) 1px, transparent 1px),
            linear-gradient(90deg, var(--color-border) 1px, transparent 1px);
          background-size: 56px 56px;
          mask-image: radial-gradient(ellipse 80% 60% at 50% 30%, #000 30%, transparent 75%);
          -webkit-mask-image: radial-gradient(ellipse 80% 60% at 50% 30%, #000 30%, transparent 75%);
          opacity: 0.45;
          pointer-events: none;
        }
        .landing-hero-glow {
          position: absolute;
          top: -120px; right: -120px;
          width: 620px; height: 620px;
          border-radius: 50%;
          background: radial-gradient(circle at center,
            color-mix(in srgb, var(--color-brand-soft, #388bfd) 28%, transparent),
            transparent 65%);
          filter: blur(60px);
          pointer-events: none;
        }
        .landing-hero-eyebrow {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 6px 14px;
          border-radius: 999px;
          border: 1px solid var(--color-border);
          background: color-mix(in srgb, var(--color-card) 80%, transparent);
          font-size: 12px;
          color: var(--color-text-secondary);
          backdrop-filter: blur(8px);
          font-weight: 500;
          letter-spacing: 0.01em;
        }

        .landing-cta-primary {
          display: inline-flex; align-items: center; gap: 10px;
          padding: 14px 28px;
          border-radius: 999px;
          background: var(--gradient-hero, linear-gradient(135deg, #1f3a6e, #1f6feb));
          color: #fff;
          font-size: 15px; font-weight: 600;
          box-shadow: 0 12px 32px -12px var(--color-brand-glow, rgba(56, 139, 253, 0.5));
          transition: transform 200ms cubic-bezier(0.16,1,0.3,1), box-shadow 200ms ease;
        }
        .landing-cta-primary:hover {
          transform: translateY(-1px);
          box-shadow: 0 16px 40px -10px var(--color-brand-glow, rgba(56, 139, 253, 0.65));
        }
        .landing-cta-secondary {
          padding: 14px 24px;
          border-radius: 999px;
          border: 1px solid var(--color-border);
          font-size: 15px; font-weight: 600;
          color: var(--color-text);
          transition: border-color 160ms ease, background 160ms ease;
        }
        .landing-cta-secondary:hover {
          border-color: var(--color-brand-soft, #388bfd);
          background: var(--color-hover);
        }

        .landing-trustrow {
          margin-top: 56px;
          display: flex; flex-wrap: wrap;
          column-gap: 18px; row-gap: 6px;
          align-items: center;
          font-size: 13px;
          color: var(--color-text-secondary);
        }
        .landing-pulsedot {
          display: inline-block;
          width: 8px; height: 8px;
          border-radius: 50%;
          background: var(--color-brand-soft, #388bfd);
          box-shadow: 0 0 12px var(--color-brand-soft, #388bfd);
          animation: landing-pulse 2.2s ease-in-out infinite;
        }
        .landing-pulsedot--green {
          background: #22c55e;
          box-shadow: 0 0 10px #22c55e;
        }
        @keyframes landing-pulse {
          0%, 100% { opacity: 0.45; }
          50%      { opacity: 1; }
        }

        /* Stat cards */
        .landing-statcard {
          padding: 28px 24px;
          border-radius: 18px;
          border: 1px solid var(--color-border);
          background: var(--color-card);
          transition: border-color 200ms ease, transform 200ms ease;
        }
        .landing-statcard:hover {
          border-color: var(--color-border-strong);
          transform: translateY(-2px);
        }
        .landing-stat-tag {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: var(--color-brand-soft, #388bfd);
        }
        .landing-stat-value {
          margin-top: 12px;
          font-size: clamp(36px, 4.5vw, 56px);
          font-weight: 600;
          letter-spacing: -0.025em;
          line-height: 1.05;
          color: var(--color-text);
          font-variant-numeric: tabular-nums;
        }
        .landing-stat-label {
          margin-top: 8px;
          font-size: 14px;
          color: var(--color-text-secondary);
        }

        /* Live Pulse cards */
        .landing-pulsecard {
          background: var(--color-card);
          border: 1px solid var(--color-border);
          border-radius: 16px;
          padding: 22px;
          transition: border-color 200ms ease, transform 200ms ease;
        }
        .landing-pulsecard:hover {
          border-color: var(--color-border-strong);
          transform: translateY(-2px);
        }
        .landing-pulsemeta {
          font-size: 12px; font-weight: 500;
          color: var(--color-muted);
          font-variant-numeric: tabular-nums;
        }
        .landing-pulsequote {
          margin-top: 14px;
          font-size: 15px; line-height: 1.55;
          color: var(--color-text);
        }
        .landing-pulseauthor {
          margin-top: 18px;
          font-size: 12px;
          color: var(--color-text-secondary);
        }
        .landing-pulserole { color: var(--color-muted); }
        .landing-severity {
          margin-top: 14px;
          font-size: 11px; font-weight: 700;
          letter-spacing: 0.05em;
          display: inline-flex; align-items: center; gap: 8px;
        }

        /* ── How It Works — cleve.ai-style feature rows ─────────────────── */
        .landing-feature {
          display: grid;
          gap: 48px;
          grid-template-columns: 1fr;
          align-items: center;
        }
        @media (min-width: 1024px) {
          .landing-feature {
            grid-template-columns: 1fr 1.1fr;
            gap: 80px;
          }
          .landing-feature.is-reverse { direction: rtl; }
          .landing-feature.is-reverse > * { direction: ltr; }
        }
        .landing-feature-text {
          max-width: 28rem;
        }
        .landing-feature-title {
          margin-top: 16px;
          font-size: clamp(32px, 3.6vw, 48px);
          line-height: 1.05;
          letter-spacing: -0.025em;
          font-weight: 600;
          color: var(--color-text);
        }
        .landing-feature-body {
          margin-top: 20px;
          font-size: 16px; line-height: 1.7;
          color: var(--color-text-secondary);
        }

        /* Photo-backed glass frame */
        .landing-feature-frame {
          position: relative;
          border-radius: 24px;
          overflow: hidden;
          padding: 28px;
          min-height: 380px;
          display: flex; align-items: center; justify-content: center;
          border: 1px solid var(--color-border);
          background: #050810;
        }
        .landing-feature-photo {
          position: absolute; inset: 0;
          background-image: url("/images/flood-background.jpeg");
          background-size: cover;
          background-position: center;
          opacity: 0.42;
          filter: saturate(1.1) contrast(1.05);
        }
        .landing-feature-vignette {
          position: absolute; inset: 0;
          background:
            radial-gradient(ellipse 70% 60% at 50% 40%, transparent 30%, rgba(5, 8, 16, 0.82) 90%),
            linear-gradient(180deg, rgba(5,8,16,0.30) 0%, rgba(5,8,16,0.10) 35%, rgba(5,8,16,0.55) 100%);
        }

        /* Glass card sitting on top of the photo */
        .landing-glass {
          position: relative;
          width: 100%;
          max-width: 460px;
          padding: 18px;
          border-radius: 20px;
          background: rgba(22, 27, 34, 0.62);
          backdrop-filter: blur(22px) saturate(160%);
          -webkit-backdrop-filter: blur(22px) saturate(160%);
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow:
            0 32px 80px -20px rgba(0,0,0,0.55),
            0 0 0 1px rgba(255,255,255,0.04) inset;
        }
        .landing-glass-head {
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 4px 12px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          margin-bottom: 14px;
        }
        .landing-glass-head--alert {
          gap: 10px;
          justify-content: flex-start;
        }
        .landing-glass-headlabel {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.92);
        }
        .landing-glass-step {
          font-size: 11px;
          color: rgba(255,255,255,0.6);
          font-variant-numeric: tabular-nums;
        }
        .landing-glass-dismiss {
          margin-left: auto;
          font-size: 11px;
          color: rgba(255,255,255,0.55);
        }
        .landing-glass-pulse {
          display: inline-block;
          width: 8px; height: 8px;
          border-radius: 50%;
          background: #22c55e;
          box-shadow: 0 0 10px #22c55e;
          animation: landing-pulse 2.2s ease-in-out infinite;
        }
        .landing-glass-foot {
          margin-top: 14px;
          padding-top: 12px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          font-size: 11px;
          color: rgba(255,255,255,0.55);
          display: flex; align-items: center; gap: 8px;
        }

        /* Sensor rows */
        .landing-sensor-row {
          display: flex; align-items: center; gap: 14px;
          padding: 12px 14px;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
        }
        .landing-sensor-id {
          font-size: 13px; font-weight: 600;
          color: rgba(255, 255, 255, 0.95);
          font-variant-numeric: tabular-nums;
        }
        .landing-sensor-river {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.5);
          margin-top: 2px;
        }
        .landing-sensor-level {
          font-size: 14px; font-weight: 700;
          color: rgba(255, 255, 255, 0.95);
          font-variant-numeric: tabular-nums;
        }
        .landing-sensor-pill {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 2px 8px;
          border-radius: 999px;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.08em;
          border: 1px solid;
        }
        .landing-sensor-ago {
          font-size: 10px;
          color: rgba(255, 255, 255, 0.4);
          font-variant-numeric: tabular-nums;
          width: 56px;
          text-align: right;
        }

        /* Report mock */
        .landing-report-field {
          display: flex; align-items: flex-start; gap: 12px;
          padding: 12px 14px;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.07);
        }
        .landing-report-field.is-textarea {
          min-height: 78px;
        }
        .landing-report-icon {
          font-size: 16px; line-height: 1.4;
          flex-shrink: 0;
        }
        .landing-report-text {
          flex: 1;
          font-size: 13px; line-height: 1.5;
          color: rgba(255, 255, 255, 0.9);
        }
        .landing-report-text--muted { color: rgba(255, 255, 255, 0.55); }
        .landing-report-thumb {
          width: 36px; height: 36px;
          border-radius: 8px;
          background:
            linear-gradient(135deg, rgba(56, 139, 253, 0.5), rgba(220, 38, 38, 0.5)),
            url("/images/flood-background.jpeg") center/cover;
          flex-shrink: 0;
        }
        .landing-report-send {
          margin-top: 16px;
          padding: 10px 18px;
          border-radius: 999px;
          background: var(--color-brand-soft, #388bfd);
          color: #fff;
          font-size: 13px; font-weight: 600;
          display: inline-flex; align-items: center; gap: 8px;
          align-self: flex-start;
          border: none;
          cursor: pointer;
          transition: opacity 160ms ease;
        }
        .landing-report-send:hover { opacity: 0.9; }

        /* Alert toasts */
        .landing-glass--alerts { padding: 14px; }
        .landing-toast {
          position: relative;
          display: flex; gap: 12px; align-items: flex-start;
          padding: 12px 14px 12px 18px;
          border-radius: 14px;
          border: 1px solid;
          color: white;
          overflow: hidden;
        }
        .landing-toast-strip {
          position: absolute;
          left: 0; top: 0; bottom: 0;
          width: 4px;
        }
        .landing-toast-eyebrow {
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          opacity: 0.95;
        }
        .landing-toast-title {
          margin-top: 4px;
          font-size: 13px;
          font-weight: 600;
        }
        .landing-toast-meta {
          margin-top: 2px;
          font-size: 11px;
          opacity: 0.92;
        }
        .landing-toast-footer {
          margin-top: 8px;
          display: flex; align-items: center; justify-content: space-between;
          font-size: 10px;
        }
        .landing-toast-close {
          font-size: 11px;
          opacity: 0.6;
          flex-shrink: 0;
        }

        /* Why fund this */
        .landing-fundcard {
          padding: 26px;
          border-radius: 18px;
          border: 1px solid var(--color-border);
          background: var(--color-card);
        }
        .landing-fund-icon {
          font-size: 28px;
          line-height: 1;
        }
        .landing-fund-title {
          margin-top: 16px;
          font-size: 18px; font-weight: 600;
          letter-spacing: -0.01em;
          color: var(--color-text);
        }
        .landing-fund-body {
          margin-top: 10px;
          font-size: 14px; line-height: 1.6;
          color: var(--color-text-secondary);
        }

        .landing-tier {
          position: relative;
          padding: 28px 24px;
          border-radius: 18px;
          border: 1px solid var(--color-border);
          background: var(--color-card);
          display: flex; flex-direction: column;
          gap: 12px;
        }
        .landing-tier--highlight {
          border-color: var(--color-brand-soft, #388bfd);
          box-shadow: 0 0 0 1px var(--color-brand-soft, #388bfd) inset,
                      0 16px 40px -16px var(--color-brand-glow, rgba(56, 139, 253, 0.4));
          background:
            linear-gradient(180deg,
              color-mix(in srgb, var(--color-brand-soft, #388bfd) 8%, var(--color-card)),
              var(--color-card) 60%);
        }
        .landing-tier-badge {
          position: absolute; top: -12px; left: 24px;
          padding: 4px 12px;
          border-radius: 999px;
          background: var(--color-brand);
          color: #fff;
          font-size: 11px; font-weight: 700;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }
        .landing-tier-label {
          font-size: 13px; font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--color-text-secondary);
        }
        .landing-tier-amount {
          font-size: 36px; font-weight: 600;
          letter-spacing: -0.02em;
          color: var(--color-text);
          font-variant-numeric: tabular-nums;
        }
        .landing-tier-cadence {
          margin-left: 8px;
          font-size: 14px;
          font-weight: 500;
          color: var(--color-muted);
        }
        .landing-tier-body {
          font-size: 14px; line-height: 1.6;
          color: var(--color-text-secondary);
          flex: 1;
        }
        .landing-tier-cta {
          align-self: flex-start;
          padding: 9px 18px;
          border-radius: 999px;
          background: var(--color-brand);
          color: #fff;
          font-size: 13px; font-weight: 600;
          margin-top: 4px;
          transition: opacity 160ms ease;
        }
        .landing-tier-cta:hover { opacity: 0.9; }

        /* Get involved cards */
        .landing-pathcard {
          padding: 28px 24px;
          border-radius: 18px;
          border: 1px solid var(--color-border);
          background: var(--color-card);
          display: flex; flex-direction: column;
          gap: 14px;
          transition: border-color 200ms ease, transform 200ms ease;
        }
        .landing-pathcard:hover {
          border-color: var(--color-border-strong);
          transform: translateY(-2px);
        }
        .landing-path-tag {
          font-size: 11px; font-weight: 700;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: var(--color-brand-soft, #388bfd);
        }
        .landing-path-title {
          font-size: 22px; font-weight: 600;
          letter-spacing: -0.015em;
          color: var(--color-text);
        }
        .landing-path-body {
          font-size: 14px; line-height: 1.6;
          color: var(--color-text-secondary);
          flex: 1;
        }
        .landing-path-cta {
          align-self: flex-start;
          padding: 9px 18px;
          border-radius: 999px;
          background: transparent;
          border: 1px solid var(--color-border);
          color: var(--color-text);
          font-size: 13px; font-weight: 600;
          transition: border-color 160ms ease, background 160ms ease;
        }
        .landing-path-cta:hover {
          border-color: var(--color-brand-soft, #388bfd);
          background: var(--color-hover);
        }

        /* Partners */
        .landing-partners {
          margin-top: 24px;
          display: flex; flex-wrap: wrap; justify-content: center;
          gap: 12px 18px;
        }
        .landing-partner {
          padding: 10px 18px;
          border-radius: 999px;
          border: 1px solid var(--color-border);
          background: var(--color-card);
          font-size: 13px; font-weight: 500;
          color: var(--color-text-secondary);
        }
        .landing-partners-note {
          margin: 24px auto 0;
          max-width: 36rem;
          font-size: 13px;
          line-height: 1.6;
          text-align: center;
          color: var(--color-muted);
        }

        /* Footer */
        .landing-footer {
          background: var(--color-bg);
          border-top: 1px solid var(--color-border);
        }
        .landing-footer-h2 {
          font-size: clamp(26px, 3.2vw, 36px);
          line-height: 1.15;
          font-weight: 600;
          letter-spacing: -0.02em;
          color: var(--color-text);
        }
        .landing-footer-lede {
          margin-top: 10px;
          max-width: 36rem;
          font-size: 16px; line-height: 1.6;
          color: var(--color-text-secondary);
        }
        .landing-emergency-card {
          display: flex; align-items: center; justify-content: space-between;
          gap: 16px;
          padding: 18px 22px;
          border-radius: 16px;
          background: var(--color-card);
          border: 1px solid var(--color-border);
          transition: border-color 160ms ease, transform 160ms ease;
        }
        .landing-emergency-card:hover {
          border-color: var(--color-brand-soft, #388bfd);
          transform: translateY(-1px);
        }
        .landing-emergency-label {
          font-size: 14px; font-weight: 600;
          color: var(--color-text);
        }
        .landing-emergency-num {
          font-family: ui-monospace, "SF Mono", Consolas, monospace;
          font-size: 22px; font-weight: 600;
          color: var(--color-text);
          font-variant-numeric: tabular-nums;
        }
        .landing-divider { border-color: var(--color-border); }
        .landing-colophon {
          max-width: 42rem;
          font-size: 14px; line-height: 1.65;
          color: var(--color-text-secondary);
        }
        .landing-tag {
          margin-top: 16px;
          font-size: 12px;
          color: var(--color-muted);
        }
        .landing-footrow {
          margin-top: 48px;
          display: flex; flex-wrap: wrap;
          align-items: center; justify-content: space-between;
          gap: 16px;
          font-size: 12px;
          color: var(--color-muted);
        }
        .landing-footrow nav a { color: var(--color-text-secondary); }
        .landing-footrow nav a:hover { color: var(--color-text); }
      `}</style>

      <LandingNav />
      <main>
        <Hero stat={safeStat} />
        <ImpactStats stat={safeStat} />
        <LivePulse stat={safeStat} />
        <HowItWorks />
        <WhyFundThis />
        <GetInvolved />
        <Partners />
      </main>
      <LandingFooter />
    </div>
  );
}
