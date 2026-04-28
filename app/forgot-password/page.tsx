"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to send reset email.");
      }
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6" style={{ background: "var(--color-bg)" }}>
      <div className="w-full max-w-md rounded-3xl border p-8 shadow-lg" style={{ background: "var(--color-card)", borderColor: "var(--color-border)" }}>
        <div className="flex justify-center mb-6">
          <Image src="/images/logo.png" alt="Pop Up Advertising And Information Enterprise" width={64} height={64} priority />
        </div>

        {sent ? (
          <div className="text-center">
            <div className="text-4xl mb-4">📧</div>
            <h2 className="text-xl font-bold mb-2" style={{ color: "var(--color-text)" }}>Check your email</h2>
            <p className="text-sm mb-6" style={{ color: "var(--color-muted)" }}>
              We sent a password reset code to <strong>{email}</strong>. Use it on the reset page.
            </p>
            <Link
              href={`/reset-password?email=${encodeURIComponent(email)}`}
              className="inline-block w-full text-center rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
              style={{ background: "var(--color-brand)" }}
            >
              Enter Reset Code
            </Link>
            <p className="mt-4 text-sm" style={{ color: "var(--color-muted)" }}>
              <Link href="/login" className="font-semibold hover:opacity-80" style={{ color: "var(--color-brand)" }}>
                ← Back to Sign In
              </Link>
            </p>
          </div>
        ) : (
          <>
            <h2 className="text-2xl font-semibold mb-2" style={{ color: "var(--color-text)" }}>Forgot Password</h2>
            <p className="text-sm mb-6" style={{ color: "var(--color-muted)" }}>
              Enter your email and we&apos;ll send you a reset code.
            </p>

            {error && (
              <div className="mb-4 rounded-xl px-4 py-3 text-sm border"
                style={{ background: "rgba(237,28,36,0.08)", borderColor: "rgba(237,28,36,0.3)", color: "var(--color-brand)" }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium mb-2" style={{ color: "var(--color-text)" }}>
                  Email Address
                </label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  placeholder="Enter your email"
                  className="w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition-colors focus:ring-2"
                  style={{ background: "var(--color-input-bg)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: "var(--color-brand)" }}
              >
                {loading ? "Sending…" : "Send Reset Code"}
              </button>
            </form>

            <p className="mt-6 text-sm text-center" style={{ color: "var(--color-muted)" }}>
              <Link href="/login" className="font-semibold hover:opacity-80" style={{ color: "var(--color-brand)" }}>
                ← Back to Sign In
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
