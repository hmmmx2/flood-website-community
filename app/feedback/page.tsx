"use client";

/**
 * Community-side UAT feedback page. The same form sits at /feedback on the
 * CRM; both submit to the same Java backend so all responses land in one
 * Postgres table that admins can review and export.
 */

import { useSession } from "next-auth/react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import UatSurveyForm, { type SurveyRole } from "@/components/survey/UatSurveyForm";
import { sessionToAuthUser } from "@/lib/auth";

export default function CommunityFeedbackPage() {
  const { data: session, status } = useSession();
  const user = session?.user ? sessionToAuthUser(session.user) : null;

  // Role inference: community-side users are "user" by default. If they're
  // also flagged as Admin (rare — happens when a staff member uses the
  // public site too), surface both question buckets so they can give a
  // resident-perspective AND a staff-perspective answer.
  const role: SurveyRole = (() => {
    const r = (user?.role ?? "").toLowerCase();
    if (r === "admin" || r === "operations_manager") return "both";
    return "user";
  })();

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <Navbar user={user} activeLink={null} breadcrumb={{ label: "Feedback" }} />

      {status === "loading" ? (
        <div className="mx-auto max-w-3xl px-6 py-16">
          <p className="text-sm" style={{ color: "var(--color-muted)" }}>Loading…</p>
        </div>
      ) : !session ? (
        <div className="mx-auto max-w-3xl px-6 py-16">
          <h1 className="text-3xl font-bold" style={{ color: "var(--color-text)" }}>
            Help us make FloodWatch better.
          </h1>
          <p className="mt-3 text-base" style={{ color: "var(--color-text-secondary)" }}>
            We&apos;d love your feedback — please sign in so we can attribute
            your response to your account.
          </p>
          <Link
            href="/login?callbackUrl=/feedback"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-[var(--color-brand)] px-6 py-3 text-sm font-semibold text-white"
          >
            Sign in to give feedback →
          </Link>
        </div>
      ) : (
        <main className="mx-auto max-w-3xl px-6 py-12">
          <header className="mb-8">
            <p
              className="text-[11px] font-semibold uppercase tracking-[0.2em]"
              style={{ color: "var(--color-brand-soft, var(--color-brand))" }}
            >
              UAT Feedback Survey
            </p>
            <h1 className="mt-3 text-3xl font-bold" style={{ color: "var(--color-text)" }}>
              Help us make FloodWatch better.
            </h1>
            <p className="mt-3 text-base leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
              Your honest feedback shapes what we build next. This survey
              takes about 3–5 minutes. Required questions are marked with{" "}
              <span style={{ color: "#dc2626" }}>*</span>.
            </p>
          </header>
          <UatSurveyForm role={role} source="community" />
        </main>
      )}

      <Footer />
    </div>
  );
}
