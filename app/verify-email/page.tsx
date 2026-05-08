"use client";

/**
 * /verify-email — second step of the registration flow.
 *
 * The /register form POSTs to /api/auth/register, which now creates the
 * user with email_verified=false and emails a 6-digit code. That route
 * pushes the user here with the email (and, in dev mode, the code) as
 * query params. The user enters the code, we POST it to /api/auth/verify-email,
 * Spring marks the account verified, returns a real session, and we
 * sign the user in via NextAuth.
 */

import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { AuthFooter, AuthTopNav } from "@/components/auth/AuthChrome";
import { MailIcon } from "@/components/icons";

function VerifyEmailInner() {
  const router = useRouter();
  const params = useSearchParams();
  const emailParam = params.get("email") ?? "";
  const devCodeParam = params.get("devCode") ?? "";

  const [email, setEmail] = useState(emailParam);
  const [code, setCode] = useState(devCodeParam);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  useEffect(() => {
    if (devCodeParam) {
      setInfo(`Dev mode — code prefilled from server response.`);
    }
  }, [devCodeParam]);

  async function handleVerify(e: FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), code: code.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Verification failed.");
      }
      // Verified server-side — establish the NextAuth session using the
      // password the user entered moments ago in /login. We don't store
      // it across the page hop on purpose; if the user landed here from
      // a fresh tab they'll have to type the password again to sign in.
      if (!password) {
        setInfo("Account verified! Sign in below to continue.");
        setTimeout(() => router.push("/login"), 1200);
        return;
      }
      const result = await signIn("credentials", {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
      });
      if (result?.error) {
        setInfo("Account verified! Please sign in.");
        setTimeout(() => router.push("/login"), 1200);
        return;
      }
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setError("");
    setInfo("");
    setResending(true);
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Couldn't resend code.");
      }
      setInfo("If an account exists for that email, a fresh code has been sent.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't resend code.");
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col" style={{ background: "var(--color-bg)" }}>
      <AuthTopNav />
      <div className="flex flex-1 flex-col items-center justify-center p-6 pt-20 sm:pt-24">
        <div
          className="w-full max-w-md rounded-3xl border p-8 shadow-lg"
          style={{ background: "var(--color-card)", borderColor: "var(--color-border)" }}
        >
          <div className="flex justify-center mb-6">
            <Image src="/images/logo.png" alt="FloodWatch" width={64} height={64} priority />
          </div>

          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[var(--color-brand)]/15 text-[var(--color-brand)] mb-3 mx-auto">
              <MailIcon className="h-8 w-8" />
            </div>
            <h2 className="text-2xl font-semibold mb-1" style={{ color: "var(--color-text)" }}>
              Verify your email
            </h2>
            <p className="text-sm" style={{ color: "var(--color-muted)" }}>
              We sent a 6-digit code to <strong style={{ color: "var(--color-text)" }}>{email || "your email"}</strong>.
            </p>
          </div>

          {error && (
            <div className="mb-4 rounded-xl px-4 py-3 text-sm border bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300">
              {error}
            </div>
          )}
          {info && !error && (
            <div className="mb-4 rounded-xl px-4 py-3 text-sm border bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300">
              {info}
            </div>
          )}

          <form onSubmit={handleVerify} className="space-y-4">
            {!emailParam && (
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: "var(--color-text)" }}>
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                  className="w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition-colors focus:ring-2"
                  style={{
                    background: "var(--color-input-bg)",
                    borderColor: "var(--color-border)",
                    color: "var(--color-text)",
                  }}
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: "var(--color-text)" }}>
                Verification code
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                required
                placeholder="000000"
                className="w-full rounded-xl border px-4 py-2.5 text-base tracking-[0.5em] text-center outline-none transition-colors focus:ring-2"
                style={{
                  background: "var(--color-input-bg)",
                  borderColor: "var(--color-border)",
                  color: "var(--color-text)",
                }}
              />
              <p className="mt-1 text-xs" style={{ color: "var(--color-muted)" }}>
                Code expires in 10 minutes.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: "var(--color-text)" }}>
                Password (so we can sign you in straight after verifying)
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter the password you just chose"
                autoComplete="new-password"
                className="w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition-colors focus:ring-2"
                style={{
                  background: "var(--color-input-bg)",
                  borderColor: "var(--color-border)",
                  color: "var(--color-text)",
                }}
              />
              <p className="mt-1 text-xs" style={{ color: "var(--color-muted)" }}>
                Optional — leave blank if you want to sign in manually after verification.
              </p>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--color-brand-dark)] disabled:opacity-50 disabled:cursor-not-allowed bg-[var(--color-brand)]"
            >
              {loading ? "Verifying…" : "Verify and continue"}
            </button>
          </form>

          <div className="mt-5 flex items-center justify-between text-sm">
            <button
              type="button"
              onClick={handleResend}
              disabled={resending || !email}
              className="font-semibold transition hover:opacity-80 text-[var(--color-brand)] disabled:opacity-50"
            >
              {resending ? "Sending…" : "Resend code"}
            </button>
            <Link href="/login" className="text-[var(--color-muted)] hover:opacity-80">
              ← Back to Sign In
            </Link>
          </div>
        </div>
      </div>
      <AuthFooter />
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center" style={{ background: "var(--color-bg)" }}>
          <p style={{ color: "var(--color-muted)" }}>Loading…</p>
        </div>
      }
    >
      <VerifyEmailInner />
    </Suspense>
  );
}
