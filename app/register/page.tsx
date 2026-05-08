"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { AuthFooter, AuthTopNav } from "@/components/auth/AuthChrome";

export default function RegisterPage() {
  const router = useRouter();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const passwordMatch = confirmPassword === "" || password === confirmPassword;

  async function handleRegister(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      // The Java service now responds 202 Accepted with an email +
      // optional dev code instead of an immediate session — the user
      // must verify the 6-digit code on /verify-email before signing in.
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName, email, password }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        email?: string;
        devCode?: string;
        error?: string;
      };

      if (!res.ok) {
        throw new Error(data.error || "Registration failed. Please try again.");
      }

      const targetEmail = data.email ?? email;
      const params = new URLSearchParams({ email: targetEmail });
      if (data.devCode) params.set("devCode", data.devCode);
      router.push(`/verify-email?${params.toString()}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col" style={{ background: "var(--color-bg)" }}>

      <AuthTopNav />

      {/* ── Main layout ────────────────────────────────────────────────── */}
      <div className="flex flex-1 pt-16">

        {/* Left hero panel */}
        <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
          <div className="absolute inset-0">
            <Image
              src="/images/flood-background.jpeg"
              alt="Flood monitoring"
              fill
              className="object-cover"
              priority
            />
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(135deg, rgba(30,58,138,0.7) 0%, rgba(29,78,216,0.5) 50%, rgba(8,145,178,0.5) 100%)",
              }}
            />
          </div>
          <div className="relative z-10 flex flex-1 flex-col justify-center items-center text-center px-12">
            <div className="drop-shadow-lg">
              <Image src="/images/logo.png" alt="Pop Up Advertising And Information Enterprise" width={100} height={100} className="mx-auto mb-6" />
              <h1 className="text-3xl font-bold text-white mb-3">Join FloodWatch</h1>
              <p className="text-base text-white/90 max-w-sm mx-auto">
                Get real-time flood alerts, share updates, and stay connected with your community.
              </p>
            </div>
          </div>
        </div>

        {/* Right form panel */}
        <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
          <div
            className="w-full max-w-md rounded-3xl border p-8 shadow-lg"
            style={{ background: "var(--color-card)", borderColor: "var(--color-border)" }}
          >
            {/* Mobile logo */}
            <div className="flex justify-center mb-6 lg:hidden">
              <Image src="/images/logo.png" alt="Pop Up Advertising And Information Enterprise" width={80} height={80} />
            </div>

            <h2 className="text-2xl font-semibold mb-1" style={{ color: "var(--color-text)" }}>
              Create Account
            </h2>
            <p className="text-sm mb-6" style={{ color: "var(--color-muted)" }}>
              Join the FloodWatch community — it&apos;s free.
            </p>

            {/* Error banner */}
            {error && (
              <div
                className="mb-4 rounded-xl px-4 py-3 text-sm border"
                style={{
                  background: "rgba(29,78,216,0.08)",
                  borderColor: "rgba(29,78,216,0.3)",
                  color: "#1d4ed8",
                }}
              >
                {error}
              </div>
            )}

            <form onSubmit={handleRegister} className="space-y-4">

              {/* Name row */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <label
                    htmlFor="firstName"
                    className="block text-sm font-medium mb-1.5"
                    style={{ color: "var(--color-text)" }}
                  >
                    First name
                  </label>
                  <input
                    id="firstName"
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="John"
                    required
                    autoComplete="given-name"
                    className="w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition-colors focus:ring-2"
                    style={{
                      background: "var(--color-input-bg)",
                      borderColor: "var(--color-border)",
                      color: "var(--color-text)",
                    }}
                  />
                </div>
                <div className="flex-1">
                  <label
                    htmlFor="lastName"
                    className="block text-sm font-medium mb-1.5"
                    style={{ color: "var(--color-text)" }}
                  >
                    Last name
                  </label>
                  <input
                    id="lastName"
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Doe"
                    required
                    autoComplete="family-name"
                    className="w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition-colors focus:ring-2"
                    style={{
                      background: "var(--color-input-bg)",
                      borderColor: "var(--color-border)",
                      color: "var(--color-text)",
                    }}
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium mb-1.5"
                  style={{ color: "var(--color-text)" }}
                >
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                  className="w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition-colors focus:ring-2"
                  style={{
                    background: "var(--color-input-bg)",
                    borderColor: "var(--color-border)",
                    color: "var(--color-text)",
                  }}
                />
              </div>

              {/* Password */}
              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium mb-1.5"
                  style={{ color: "var(--color-text)" }}
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    className="w-full rounded-xl border px-4 py-2.5 pr-16 text-sm outline-none transition-colors focus:ring-2"
                    style={{
                      background: "var(--color-input-bg)",
                      borderColor: "var(--color-border)",
                      color: "var(--color-text)",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-sm transition-colors"
                    style={{ color: "var(--color-muted)" }}
                  >
                    {showPw ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              {/* Confirm password */}
              <div>
                <label
                  htmlFor="confirmPassword"
                  className="block text-sm font-medium mb-1.5"
                  style={{ color: "var(--color-text)" }}
                >
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat your password"
                  required
                  autoComplete="new-password"
                  className="w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition-colors focus:ring-2"
                  style={{
                    background: "var(--color-input-bg)",
                    borderColor: !passwordMatch ? "#ef4444" : "var(--color-border)",
                    color: "var(--color-text)",
                  }}
                />
                {!passwordMatch && (
                  <p className="mt-1 text-xs" style={{ color: "#ef4444" }}>
                    Passwords do not match
                  </p>
                )}
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading || !passwordMatch}
                className="w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1e40af] disabled:opacity-50 disabled:cursor-not-allowed bg-[#1d4ed8]"
              >
                {loading ? "Creating account…" : "Create Account"}
              </button>
            </form>

            {/* Sign-in link */}
            <p className="mt-6 text-sm text-center" style={{ color: "var(--color-muted)" }}>
              Already have an account?{" "}
              <Link
                href="/login"
                className="font-semibold transition hover:opacity-80 text-[#1d4ed8]"
              >
                Sign In
              </Link>
            </p>
          </div>
        </div>
      </div>

      <AuthFooter />
    </div>
  );
}
