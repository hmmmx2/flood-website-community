"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { signIn } from "next-auth/react";
import { AuthFooter, AuthTopNav } from "@/components/auth/AuthChrome";
import type { AuthUser } from "@/lib/auth";

type View = "login" | "register";

const FALLBACK_CRM = "http://localhost:3000";

async function getCrmUrl(): Promise<string> {
  try {
    const res = await fetch("/api/auth/crm-url");
    if (!res.ok) return FALLBACK_CRM;
    const data = (await res.json()) as { url?: string };
    return typeof data.url === "string" && data.url.length > 0 ? data.url : FALLBACK_CRM;
  } catch {
    return FALLBACK_CRM;
  }
}

async function redirectToAdmin(
  accessToken: string,
  refreshToken: string,
  user: AuthUser,
) {
  const crmBase = await getCrmUrl();
  const u = encodeURIComponent(JSON.stringify(user));
  window.location.href = `${crmBase}/auth/callback?at=${encodeURIComponent(accessToken)}&rt=${encodeURIComponent(refreshToken)}&u=${u}`;
}

export default function LoginPage() {
  const router = useRouter();
  const [view, setView] = useState<View>("login");

  // Login
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPw, setShowLoginPw] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Register
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [showRegPw, setShowRegPw] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: loginEmail,
          password: loginPassword,
        }),
      });

      const body = (await res.json().catch(() => ({}))) as
        | {
            session: { accessToken: string; refreshToken: string };
            user: {
              id: string;
              email: string;
              displayName: string;
              avatarUrl?: string;
              role: string;
            };
          }
        | { error?: string };

      if (!res.ok) {
        throw new Error(
          "error" in body && typeof body.error === "string"
            ? body.error
            : "Invalid email or password.",
        );
      }

      const payload = body as {
        session: { accessToken: string; refreshToken: string };
        user: {
          id: string;
          email: string;
          displayName: string;
          avatarUrl?: string;
          role: string;
        };
      };

      if (payload.user.role?.toLowerCase() === "admin") {
        const adminUser: AuthUser = {
          id: payload.user.id,
          email: payload.user.email,
          displayName: payload.user.displayName,
          avatarUrl: payload.user.avatarUrl,
          role: payload.user.role,
        };
        await redirectToAdmin(
          payload.session.accessToken,
          payload.session.refreshToken,
          adminUser,
        );
        return;
      }

      const result = await signIn("credentials", {
        email: loginEmail,
        password: loginPassword,
        redirect: false,
      });

      if (result?.error) {
        throw new Error("Login failed. Please try again.");
      }

      const callbackUrl = new URLSearchParams(window.location.search).get(
        "callbackUrl",
      );
      router.push(callbackUrl ?? "/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (regPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      // Step 1: create account on Spring Boot
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName,
          lastName,
          email: regEmail,
          password: regPassword,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Registration failed.");
      }

      // Step 2: sign in via NextAuth to establish the session cookie
      const result = await signIn("credentials", {
        email: regEmail,
        password: regPassword,
        redirect: false,
      });
      if (result?.error) {
        throw new Error("Account created but sign-in failed. Please log in.");
      }
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col" style={{ background: "var(--color-bg)" }}>

      <AuthTopNav />

      {/* Main content */}
      <div className="flex flex-1 pt-16">

        {/* Left panel — hero image */}
        <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
          <div className="absolute inset-0">
            <Image
              src="/images/flood-background.jpeg"
              alt="Flood monitoring"
              fill
              sizes="50vw"
              className="object-cover"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-br from-blue-900/70 via-blue-600/50 to-cyan-600/50 dark:from-zinc-900/90 dark:via-zinc-800/80 dark:to-slate-800/50" />
          </div>
          <div className="relative z-10 flex flex-1 flex-col justify-center items-center text-center px-12">
            <div className="drop-shadow-lg">
              <Image src="/images/logo.png" alt="Pop Up Advertising And Information Enterprise" width={100} height={100} className="mx-auto mb-6" priority />
              <h1 className="text-3xl font-bold text-white mb-3">FloodWatch Community</h1>
              <p className="text-base text-white/90 max-w-sm mx-auto">
                Real-time flood alerts and community updates for Sarawak, powered by IoT sensors.
              </p>
            </div>
          </div>
        </div>

        {/* Right panel — form */}
        <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
          <div
            className="w-full max-w-md rounded-3xl border p-8 shadow-lg"
            style={{ background: "var(--color-card)", borderColor: "var(--color-border)" }}
          >
            {/* Logo (mobile only) */}
            <div className="flex justify-center mb-6 lg:hidden">
              <Image src="/images/logo.png" alt="Pop Up Advertising And Information Enterprise" width={80} height={80} priority />
            </div>

            {/* ── Login view ─────────────────────────────────────────────── */}
            {view === "login" && (
              <>
                <h2 className="text-2xl font-semibold mb-2" style={{ color: "var(--color-text)" }}>
                  Welcome Back
                </h2>
                <p className="text-sm mb-6" style={{ color: "var(--color-muted)" }}>
                  Sign in to your account to continue
                </p>
                {error && (
                  <div className="mb-4 rounded-xl px-4 py-3 text-sm border bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300">
                    {error}
                  </div>
                )}
                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium mb-2" style={{ color: "var(--color-text)" }}>
                      Email Address
                    </label>
                    <input
                      type="email"
                      id="email"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      required
                      autoComplete="email"
                      placeholder="Enter your email"
                      className="w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition-colors focus:ring-2"
                      style={{
                        background: "var(--color-input-bg)",
                        borderColor: "var(--color-border)",
                        color: "var(--color-text)",
                      }}
                    />
                  </div>
                  <div>
                    <label htmlFor="password" className="block text-sm font-medium mb-2" style={{ color: "var(--color-text)" }}>
                      Password
                    </label>
                    <div className="relative">
                      <input
                        type={showLoginPw ? "text" : "password"}
                        id="password"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        required
                        autoComplete="current-password"
                        placeholder="Enter your password"
                        className="w-full rounded-xl border px-4 py-2.5 pr-16 text-sm outline-none transition-colors focus:ring-2"
                        style={{
                          background: "var(--color-input-bg)",
                          borderColor: "var(--color-border)",
                          color: "var(--color-text)",
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowLoginPw(!showLoginPw)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-sm transition-colors"
                        style={{ color: "var(--color-muted)" }}
                      >
                        {showLoginPw ? "Hide" : "Show"}
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={e => setRememberMe(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 accent-[var(--color-brand)]"
                      />
                      <span style={{ color: "var(--color-muted)" }}>Remember me</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => router.push("/forgot-password")}
                      className="font-semibold transition hover:opacity-80 text-[var(--color-brand)]"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--color-brand-dark)] disabled:opacity-50 disabled:cursor-not-allowed bg-[var(--color-brand)]"
                  >
                    {loading ? "Signing in…" : "Sign In"}
                  </button>
                </form>
                <p className="mt-6 text-sm text-center" style={{ color: "var(--color-muted)" }}>
                  Don&apos;t have an account?{" "}
                  <button
                    onClick={() => { setView("register"); setError(""); }}
                    className="font-semibold transition hover:opacity-80 text-[var(--color-brand)]"
                    type="button"
                  >
                    Create one
                  </button>
                </p>
              </>
            )}

            {/* ── Register view ──────────────────────────────────────────── */}
            {view === "register" && (
              <>
                <h2 className="text-2xl font-semibold mb-2" style={{ color: "var(--color-text)" }}>
                  Create Account
                </h2>
                <p className="text-sm mb-6" style={{ color: "var(--color-muted)" }}>
                  Join the FloodWatch community
                </p>
                {error && (
                  <div className="mb-4 rounded-xl px-4 py-3 text-sm border bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300">
                    {error}
                  </div>
                )}
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="block text-sm font-medium mb-2" style={{ color: "var(--color-text)" }}>
                        First name
                      </label>
                      <input
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
                      <label className="block text-sm font-medium mb-2" style={{ color: "var(--color-text)" }}>
                        Last name
                      </label>
                      <input
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
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: "var(--color-text)" }}>
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="Enter your email"
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
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: "var(--color-text)" }}>
                      Password
                    </label>
                    <div className="relative">
                      <input
                        type={showRegPw ? "text" : "password"}
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="Enter your password"
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
                        onClick={() => setShowRegPw(!showRegPw)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-sm transition-colors"
                        style={{ color: "var(--color-muted)" }}
                      >
                        {showRegPw ? "Hide" : "Show"}
                      </button>
                    </div>
                    <p className="mt-1 text-xs" style={{ color: "var(--color-muted)" }}>Minimum 8 characters</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: "var(--color-text)" }}>
                      Confirm Password
                    </label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm your password"
                      required
                      autoComplete="new-password"
                      className="w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition-colors focus:ring-2"
                      style={{
                        background: "var(--color-input-bg)",
                        borderColor: "var(--color-border)",
                        color: "var(--color-text)",
                      }}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--color-brand-dark)] disabled:opacity-50 disabled:cursor-not-allowed bg-[var(--color-brand)]"
                  >
                    {loading ? "Creating account…" : "Create Account"}
                  </button>
                </form>
                <p className="mt-6 text-sm text-center" style={{ color: "var(--color-muted)" }}>
                  Already have an account?{" "}
                  <button
                    onClick={() => { setView("login"); setError(""); }}
                    className="font-semibold transition hover:opacity-80 text-[var(--color-brand)]"
                    type="button"
                  >
                    Sign In
                  </button>
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      <AuthFooter />
    </div>
  );
}
