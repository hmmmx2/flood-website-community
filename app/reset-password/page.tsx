"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

type Step = "verify" | "reset" | "done";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<Step>("verify");
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleVerify(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-reset-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Invalid or expired code.");
      }
      setStep("reset");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleReset(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (newPassword.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (newPassword !== confirmPassword) { setError("Passwords do not match."); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, newPassword }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to reset password.");
      }
      setStep("done");
      setTimeout(() => router.push("/login"), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6" style={{ background: "var(--color-bg)" }}>
      <div className="w-full max-w-md rounded-3xl border p-8 shadow-lg" style={{ background: "var(--color-card)", borderColor: "var(--color-border)" }}>
        <div className="flex justify-center mb-6">
          <Image src="/images/logo.png" alt="Pop Up Advertising And Information Enterprise" width={64} height={64} />
        </div>

        {step === "done" ? (
          <div className="text-center">
            <div className="text-4xl mb-4">✅</div>
            <h2 className="text-xl font-bold mb-2" style={{ color: "var(--color-text)" }}>Password Reset!</h2>
            <p className="text-sm mb-4" style={{ color: "var(--color-muted)" }}>
              Your password has been updated. Redirecting to sign in…
            </p>
            <Link href="/login" className="font-semibold hover:opacity-80" style={{ color: "var(--color-brand)" }}>
              Sign In now
            </Link>
          </div>
        ) : step === "verify" ? (
          <>
            <h2 className="text-2xl font-semibold mb-2" style={{ color: "var(--color-text)" }}>Enter Reset Code</h2>
            <p className="text-sm mb-6" style={{ color: "var(--color-muted)" }}>
              Enter the code sent to your email along with your email address.
            </p>

            {error && (
              <div className="mb-4 rounded-xl px-4 py-3 text-sm border"
                style={{ background: "rgba(29,78,216,0.08)", borderColor: "rgba(29,78,216,0.3)", color: "var(--color-brand)" }}>
                {error}
              </div>
            )}

            <form onSubmit={handleVerify} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: "var(--color-text)" }}>Email Address</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="Your email"
                  className="w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition-colors focus:ring-2"
                  style={{ background: "var(--color-input-bg)", borderColor: "var(--color-border)", color: "var(--color-text)" }} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: "var(--color-text)" }}>Reset Code</label>
                <input type="text" value={code} onChange={e => setCode(e.target.value.trim())} required placeholder="Enter the code from your email"
                  className="w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition-colors focus:ring-2 font-mono tracking-widest text-center"
                  style={{ background: "var(--color-input-bg)", borderColor: "var(--color-border)", color: "var(--color-text)" }} />
              </div>
              <button type="submit" disabled={loading}
                className="w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                style={{ background: "var(--color-brand)" }}>
                {loading ? "Verifying…" : "Verify Code"}
              </button>
            </form>
            <p className="mt-6 text-sm text-center" style={{ color: "var(--color-muted)" }}>
              <Link href="/forgot-password" className="font-semibold hover:opacity-80" style={{ color: "var(--color-brand)" }}>
                Resend code
              </Link>
              {" · "}
              <Link href="/login" className="hover:opacity-80" style={{ color: "var(--color-muted)" }}>
                Back to Sign In
              </Link>
            </p>
          </>
        ) : (
          <>
            <h2 className="text-2xl font-semibold mb-2" style={{ color: "var(--color-text)" }}>New Password</h2>
            <p className="text-sm mb-6" style={{ color: "var(--color-muted)" }}>Choose a strong password for your account.</p>

            {error && (
              <div className="mb-4 rounded-xl px-4 py-3 text-sm border"
                style={{ background: "rgba(29,78,216,0.08)", borderColor: "rgba(29,78,216,0.3)", color: "var(--color-brand)" }}>
                {error}
              </div>
            )}

            <form onSubmit={handleReset} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: "var(--color-text)" }}>New Password</label>
                <div className="relative">
                  <input type={showPw ? "text" : "password"} value={newPassword} onChange={e => setNewPassword(e.target.value)}
                    required minLength={8} placeholder="At least 8 characters"
                    className="w-full rounded-xl border px-4 py-2.5 pr-16 text-sm outline-none transition-colors focus:ring-2"
                    style={{ background: "var(--color-input-bg)", borderColor: "var(--color-border)", color: "var(--color-text)" }} />
                  <button type="button" onClick={() => setShowPw(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: "var(--color-muted)" }}>
                    {showPw ? "Hide" : "Show"}
                  </button>
                </div>
                <p className="mt-1 text-xs" style={{ color: "var(--color-muted)" }}>Minimum 8 characters</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: "var(--color-text)" }}>Confirm Password</label>
                <input type={showPw ? "text" : "password"} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                  required placeholder="Repeat your new password"
                  className="w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition-colors focus:ring-2"
                  style={{ background: "var(--color-input-bg)", borderColor: "var(--color-border)", color: "var(--color-text)" }} />
              </div>
              <button type="submit" disabled={loading}
                className="w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                style={{ background: "var(--color-brand)" }}>
                {loading ? "Resetting…" : "Reset Password"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center" style={{ background: "var(--color-bg)" }}>
        <p style={{ color: "var(--color-muted)" }}>Loading…</p>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
