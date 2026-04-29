"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { saveSession, AuthUser } from "@/lib/auth";

const CRM_URL = process.env.NEXT_PUBLIC_CRM_URL || "http://localhost:3000";
type View = "login" | "register";

// Java API returns: { session: { accessToken, refreshToken }, user: { id, email, displayName, role } }
type LoginResponse = {
  session: {
    accessToken: string;
    refreshToken: string;
  };
  user: {
    id: string;
    email: string;
    displayName: string;
    avatarUrl?: string;
    role: string;
  };
};

function redirectToAdmin(accessToken: string, refreshToken: string, user: AuthUser) {
  const u = encodeURIComponent(JSON.stringify(user));
  window.location.href = `${CRM_URL}/auth/callback?at=${encodeURIComponent(accessToken)}&rt=${encodeURIComponent(refreshToken)}&u=${u}`;
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
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Invalid email or password.");
      }
      const data: LoginResponse = await res.json();
      const user: AuthUser = {
        id: data.user.id,
        email: data.user.email,
        displayName: data.user.displayName,
        avatarUrl: data.user.avatarUrl,
        role: data.user.role,
      };
      if (data.user.role === "admin") {
        // TODO: Re-enable MFA once admin email account is configured to receive verification codes.
        // await fetch("/api/auth/forgot-password", {
        //   method: "POST",
        //   headers: { "Content-Type": "application/json" },
        //   body: JSON.stringify({ email: data.user.email }),
        // });
        // setPendingSession({ accessToken: data.session.accessToken, refreshToken: data.session.refreshToken, user });
        // setView("mfa");

        // Save community session so the navbar and settings page work if admin returns to community site
        saveSession({ accessToken: data.session.accessToken, refreshToken: data.session.refreshToken }, user);
        redirectToAdmin(data.session.accessToken, data.session.refreshToken, user);
      } else {
        saveSession({ accessToken: data.session.accessToken, refreshToken: data.session.refreshToken }, user);
        router.push("/");
      }
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
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName, email: regEmail, password: regPassword }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Registration failed.");
      }
      const data: LoginResponse = await res.json();
      const user: AuthUser = {
        id: data.user.id,
        email: data.user.email,
        displayName: data.user.displayName,
        avatarUrl: data.user.avatarUrl,
        role: data.user.role,
      };
      saveSession({ accessToken: data.session.accessToken, refreshToken: data.session.refreshToken }, user);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col" style={{ background: "var(--color-bg)" }}>

      {/* Navbar */}
      <nav
        className="fixed top-0 left-0 right-0 z-50 border-b backdrop-blur-md"
        style={{ borderColor: "var(--color-border)", background: "rgba(255,255,255,0.8)" }}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <Image src="/images/logo.png" alt="Pop Up Advertising And Information Enterprise" width={36} height={36} priority />
            <span className="hidden sm:block text-sm font-semibold" style={{ color: "var(--color-text)" }}>
              FloodWatch Community
            </span>
          </div>
        </div>
      </nav>

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
            <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, rgba(30,58,138,0.7) 0%, rgba(29,78,216,0.5) 50%, rgba(8,145,178,0.5) 100%)" }} />
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

            {/* ── Login view ─────────────────────────────────────── */}
            {view === "login" && (
              <>
                <h2 className="text-2xl font-semibold mb-2" style={{ color: "var(--color-text)" }}>
                  Welcome Back
                </h2>
                <p className="text-sm mb-6" style={{ color: "var(--color-muted)" }}>
                  Sign in to your account to continue
                </p>
                {error && (
                  <div
                    className="mb-4 rounded-xl px-4 py-3 text-sm border"
                    style={{ background: "rgba(29,78,216,0.08)", borderColor: "rgba(29,78,216,0.3)", color: "#1d4ed8" }}
                  >
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
                        className="h-4 w-4 rounded border-slate-300 text-[#1d4ed8] accent-[#1d4ed8] focus:ring-[#1d4ed8]"
                        style={{ accentColor: "#1d4ed8" }}
                      />
                      <span style={{ color: "var(--color-muted)" }}>Remember me</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => router.push("/forgot-password")}
                      className="font-semibold transition hover:opacity-80 text-[#1d4ed8]"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1e40af] disabled:opacity-50 disabled:cursor-not-allowed bg-[#1d4ed8]"
                  >
                    {loading ? "Signing in…" : "Sign In"}
                  </button>
                </form>
                <p className="mt-6 text-sm text-center" style={{ color: "var(--color-muted)" }}>
                  Don&apos;t have an account?{" "}
                  <button
                    onClick={() => { setView("register"); setError(""); }}
                    className="font-semibold transition hover:opacity-80 text-[#1d4ed8]"
                    type="button"
                  >
                    Create one
                  </button>
                </p>
              </>
            )}

            {/* ── Register view ──────────────────────────────────── */}
            {view === "register" && (
              <>
                <h2 className="text-2xl font-semibold mb-2" style={{ color: "var(--color-text)" }}>
                  Create Account
                </h2>
                <p className="text-sm mb-6" style={{ color: "var(--color-muted)" }}>
                  Join the FloodWatch community
                </p>
                {error && (
                  <div
                    className="mb-4 rounded-xl px-4 py-3 text-sm border"
                    style={{ background: "rgba(29,78,216,0.08)", borderColor: "rgba(29,78,216,0.3)", color: "#1d4ed8" }}
                  >
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
                    className="w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1e40af] disabled:opacity-50 disabled:cursor-not-allowed bg-[#1d4ed8]"
                  >
                    {loading ? "Creating account…" : "Create Account"}
                  </button>
                </form>
                <p className="mt-6 text-sm text-center" style={{ color: "var(--color-muted)" }}>
                  Already have an account?{" "}
                  <button
                    onClick={() => { setView("login"); setError(""); }}
                    className="font-semibold transition hover:opacity-80 text-[#1d4ed8]"
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

      {/* Footer */}
      <footer
        className="border-t py-4"
        style={{ borderColor: "var(--color-border)", background: "rgba(255,255,255,0.5)" }}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-xs" style={{ color: "var(--color-muted)" }}>
            © {new Date().getFullYear()} FloodWatch Community. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <a href="#" className="text-xs transition hover:opacity-80" style={{ color: "var(--color-muted)" }}>Privacy Policy</a>
            <a href="#" className="text-xs transition hover:opacity-80" style={{ color: "var(--color-muted)" }}>Terms of Service</a>
            <a href="#" className="text-xs transition hover:opacity-80" style={{ color: "var(--color-muted)" }}>Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
