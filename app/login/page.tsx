"use client";

import { useState, useEffect, FormEvent, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { signIn } from "next-auth/react";
import { AuthFooter, AuthTopNav } from "@/components/auth/AuthChrome";
import type { AuthUser } from "@/lib/auth";
import { isOperatorRole } from "@/lib/rbac";

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

/**
 * Build the CRM `/auth/callback` URL using the new opaque-code SSO
 * handoff. Tokens never appear in this URL — only the short-lived
 * code that the CRM redeems against Upstash. See `lib/sso.ts`.
 *
 * Pure-ish: the only side effect is the Upstash write inside
 * `/api/auth/sso/start`. Throws on network failure so the caller
 * can fall back to a friendly error banner.
 */
async function buildCrmCallbackUrl(
  accessToken: string,
  refreshToken: string,
  user: AuthUser,
  expiresAt: string,
): Promise<string> {
  const [crmBase, code] = await Promise.all([
    getCrmUrl(),
    mintSsoHandoffCode({ accessToken, refreshToken, user, expiresAt }),
  ]);
  return `${crmBase}/auth/callback?code=${encodeURIComponent(code)}`;
}

/**
 * POST to /api/auth/sso/start. Returns the opaque code or throws
 * with a stable error key the form can render.
 */
async function mintSsoHandoffCode(payload: {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
  expiresAt: string;
}): Promise<string> {
  const res = await fetch("/api/auth/sso/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    if (res.status === 403 && body.error === "not_operator") {
      throw new Error("not_operator");
    }
    if (res.status === 503) {
      // Server logged the precise reason. The "storage_unavailable"
      // variant means Upstash env vars aren't set on this deployment
      // (the SSO handoff stash lives in Redis). Operators see a
      // clearer message; the runbook is to set the env vars on the
      // community Vercel project. See VERCEL_DEPLOYMENT.md.
      if (body.error === "sso_storage_unavailable") {
        throw new Error("sso_storage_unavailable");
      }
      throw new Error("sso_unavailable");
    }
    throw new Error("sso_failed");
  }
  const { code } = (await res.json()) as { code: string };
  return code;
}

/**
 * QA P1-9 — Validate the `/api/auth/login` response shape at runtime.
 * Returns the parsed payload on success or `null` if anything is
 * missing / wrong type. Hand-rolled so we don't pull in a 14-KB
 * validation library for one schema; if we end up validating more
 * response shapes, switch to `zod` or `valibot`.
 */
type LoginSuccessPayload = {
  session: {
    accessToken: string;
    refreshToken: string;
    expiresAt?: string;
  };
  user: {
    id: string;
    email: string;
    displayName: string;
    avatarUrl?: string;
    role: string;
  };
};

function validateLoginResponse(raw: unknown): LoginSuccessPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const session = o.session as Record<string, unknown> | undefined;
  const user = o.user as Record<string, unknown> | undefined;
  if (!session || typeof session !== "object") return null;
  if (!user || typeof user !== "object") return null;
  if (typeof session.accessToken !== "string" || session.accessToken.length === 0) return null;
  if (typeof session.refreshToken !== "string" || session.refreshToken.length === 0) return null;
  if (session.expiresAt !== undefined && typeof session.expiresAt !== "string") return null;
  if (typeof user.id !== "string" || user.id.length === 0) return null;
  if (typeof user.email !== "string" || user.email.length === 0) return null;
  if (typeof user.displayName !== "string") return null;
  if (typeof user.role !== "string" || user.role.length === 0) return null;
  if (user.avatarUrl !== undefined && typeof user.avatarUrl !== "string") return null;
  return raw as LoginSuccessPayload;
}

const ERROR_MESSAGES: Record<string, string> = {
  invalid_session: "Your session expired or was invalid. Please sign in again.",
  CredentialsSignin: "Invalid email or password.",
  role: "Your account is not authorised for CRM access. Please use the community site for end-user features.",
  expired: "Your session expired. Please sign in again.",
  invalid_signature:
    "Your session token is invalid. Please sign in again — if this keeps happening, contact your administrator.",
  malformed:
    "Your session token is malformed. Please sign in again — if this keeps happening, contact your administrator.",
  misconfigured:
    "Sign-in is temporarily misconfigured on the operator console. The team has been notified — please try again in a few minutes.",
  sso_expired: "Sign-in handoff expired. Please sign in again.",
  sso_failed: "Sign-in handoff failed. Please try again.",
  sso_unavailable: "Sign-in service is temporarily unavailable. Please try again in a moment.",
  sso_storage_unavailable:
    "Sign-in is temporarily misconfigured (handoff storage). The team has been notified — please try again in a few minutes.",
  callback: "Sign-in failed during redirect. Please try again.",
  not_operator: "This account is not authorised for CRM access.",
};

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
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

  // CRM redirect fallback. When an operator-class account signs in,
  // we set `window.location.href` to the CRM callback. Some embedded
  // browsers (notably the Claude Code preview tool) silently refuse
  // cross-port localhost navigation — the navigation just no-ops and
  // the user is left sitting on /login with no feedback. To make
  // that case debuggable, if the page is STILL on /login ~1.2 s
  // after we kicked off the navigation, we surface a visible
  // "Continue to CRM Dashboard" link with the explicit URL the user
  // can click manually (or copy to a real browser tab). In a normal
  // browser the navigation completes long before the timer fires
  // and `crmRedirectUrl` is never read.
  const [crmRedirectUrl, setCrmRedirectUrl] = useState<string | null>(null);

  // Surface the ?error=… code from /auth/callback redirects, NextAuth
  // failures, etc. so the user sees why they got bounced back to login.
  useEffect(() => {
    const code = searchParams.get("error");
    if (code) setError(ERROR_MESSAGES[code] ?? "Sign in failed. Please try again.");
  }, [searchParams]);

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
            session: {
              accessToken: string;
              refreshToken: string;
              expiresAt?: string;
            };
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
        const msg =
          "error" in body && typeof body.error === "string"
            ? body.error
            : "Invalid email or password.";
        if (/verify your email/i.test(msg)) {
          // Account exists but email isn't verified — re-issue a code and
          // bounce them to the verification screen.
          await fetch("/api/auth/resend-verification", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: loginEmail.trim().toLowerCase() }),
          }).catch(() => {});
          router.push(`/verify-email?email=${encodeURIComponent(loginEmail.trim().toLowerCase())}`);
          return;
        }
        throw new Error(msg);
      }

      // QA P1-9 — Validate the response shape before we trust it for
      // routing. A drift on the Java side (renamed `role` field, JSON
      // null where a string is expected, etc.) used to silently coerce
      // and could land an operator on the community home page or a
      // Customer on the CRM /auth/callback that then 403s. Belt-and-
      // braces against contract drift; failure here means we ask the
      // user to retry rather than acting on garbage.
      const payload = validateLoginResponse(body);
      if (!payload) {
        throw new Error("Sign-in succeeded but the response was malformed. Please try again.");
      }

      // RBAC routing decision. The canonical `routeForRole` in
      // `lib/rbac.ts` is shared (byte-identical) with the CRM, so
      // every redirect target is in lockstep with the CRM's own
      // gates. Operator-class accounts (Admin / Operations Manager
      // / Field Technician / NGO Volunteer / Viewer) belong on the
      // CRM. Customers stay on community. Unknown roles default to
      // community / and surface an error there.
      //
      // The CRM's /auth/callback re-verifies the JWT signature +
      // role on redeem, so a forged `role` claim here cannot unlock
      // the CRM; the worst case is one extra round-trip and a 403.
      if (isOperatorRole(payload.user.role)) {
        const adminUser: AuthUser = {
          id: payload.user.id,
          email: payload.user.email,
          displayName: payload.user.displayName,
          avatarUrl: payload.user.avatarUrl,
          role: payload.user.role,
        };
        const url = await buildCrmCallbackUrl(
          payload.session.accessToken,
          payload.session.refreshToken,
          adminUser,
          payload.session.expiresAt ?? new Date(Date.now() + 15 * 60_000).toISOString(),
        );

        // Detect environments where cross-port localhost navigation
        // is blocked (notably the Claude Code preview tool, which
        // pops a "Link to localhost was blocked. Preview only
        // supports localhost URLs." overlay every time you try).
        //
        // Heuristic: in dev, the CRM URL points at a different port
        // than the page we're on. If we're inside such an embedded
        // browser, kicking off a window.location.href to that
        // cross-port URL would trigger the preview block — so
        // instead we render an instructional panel with the URL
        // ready to copy. In production (Vercel) the CRM is on a
        // different hostname, not a different localhost port, and
        // this branch never matters.
        const target = (() => {
          try {
            return new URL(url);
          } catch {
            return null;
          }
        })();
        const samePortAsHere =
          target !== null &&
          target.hostname === window.location.hostname &&
          target.port === window.location.port;
        const crossPortLocalhost =
          target !== null &&
          (target.hostname === "localhost" ||
            target.hostname === "127.0.0.1") &&
          !samePortAsHere;

        if (crossPortLocalhost) {
          // Don't even attempt the navigation — that would surface
          // the preview tool's block overlay. Just show the user
          // exactly what to do.
          setCrmRedirectUrl(url);
          return;
        }

        // Stash the URL so the fallback CAN still render if the
        // navigation silently no-ops for any other reason; in a
        // normal cross-port browser nav this state is unmounted
        // before the user sees it.
        setCrmRedirectUrl(url);
        window.location.href = url;
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
      // /api/auth/register no longer auto-logs the user in. The Java
      // service responds 202 Accepted with a `RegisterPendingDto`
      // (email + optional dev code) and emails the 6-digit code. We
      // bounce the user to /verify-email — they enter the code, the
      // backend marks email_verified=true, and only then does a session
      // get issued.
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
      const data = (await res.json().catch(() => ({}))) as {
        email?: string;
        devCode?: string;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || "Registration failed.");
      }
      const targetEmail = data.email ?? regEmail;
      // QA NEW-1 — Keep the dev-mode 6-digit code OUT of the URL.
      // Previously: `?email=...&devCode=123456` left a copy of the code
      // in browser history, server access logs, Referer headers. Now
      // we drop it into sessionStorage (cleared on tab close) and the
      // verify-email page reads it on mount. The email stays in the
      // URL because that's identifying-but-not-secret + makes back
      // navigation work intuitively.
      if (data.devCode && typeof window !== "undefined") {
        try {
          sessionStorage.setItem("verify_email_dev_code", data.devCode);
        } catch {
          // sessionStorage may be unavailable (Safari private mode);
          // user falls back to typing the code from their email.
        }
      }
      const params = new URLSearchParams({ email: targetEmail });
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
            {/* Same inline gradient as the register page so the hero
                overlay is identical across the auth flow in both light
                and dark mode (Tailwind dark:* variants here used to swap
                to greys, which made the two pages look unrelated). */}
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
              <Image src="/images/logo.png" alt="Pop Up Advertising And Information Enterprise" width={100} height={100} className="mx-auto mb-6" priority />
              <h1 className="text-3xl font-bold text-white mb-3">FloodWatch Community</h1>
              <p className="text-base text-white/90 max-w-sm mx-auto">
                Real-time flood alerts and community updates for Sabah, powered by IoT sensors.
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
                {crmRedirectUrl && (
                  // Rendered when the in-page admin redirect can't
                  // happen automatically — most commonly inside the
                  // Claude Code preview tool, which silently blocks
                  // ALL cross-port localhost navigation (`window.
                  // location.href`, `<a>.click()`, `window.open`,
                  // even `fetch`) and shows a "Link to localhost
                  // was blocked. Preview only supports localhost
                  // URLs." overlay if you try. So instead of a
                  // clickable link (which would trigger that
                  // overlay), we show the URL as copyable text plus
                  // a one-click copy button. The user opens it in
                  // a normal Chrome / Edge / Firefox tab.
                  //
                  // In real browsers the page either already
                  // navigated (in which case this is unmounted) or
                  // production was reached (where the CRM lives on
                  // a different hostname, no cross-port issue).
                  <div className="mb-4 rounded-xl border bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 px-4 py-3 text-sm text-blue-800 dark:text-blue-200">
                    <p className="mb-2 font-medium">
                      Sign-in succeeded. The CRM dashboard is on a different
                      port, which the Claude Code preview can&apos;t navigate to.
                    </p>
                    <p className="mb-2">
                      Copy the URL below and paste it into a normal Chrome /
                      Edge / Firefox tab to continue:
                    </p>
                    <div className="flex items-stretch gap-2">
                      <input
                        readOnly
                        value={crmRedirectUrl}
                        onFocus={(e) => e.currentTarget.select()}
                        className="flex-1 rounded-lg border border-blue-300 dark:border-blue-700 bg-white dark:bg-blue-950/50 px-3 py-1.5 font-mono text-xs"
                        aria-label="CRM dashboard URL"
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(crmRedirectUrl);
                          } catch {
                            // Fallback: select() so the user can hit Ctrl+C.
                            const el = document.querySelector<HTMLInputElement>(
                              'input[aria-label="CRM dashboard URL"]',
                            );
                            el?.select();
                          }
                        }}
                        className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                      >
                        Copy
                      </button>
                    </div>
                    <p className="mt-2 text-xs opacity-75">
                      The URL contains your one-time session tokens and is
                      valid for ~15 minutes. In production the redirect
                      happens automatically — this only shows up in the
                      preview-tool dev environment.
                    </p>
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

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center" style={{ background: "var(--color-bg)" }}>
          <p style={{ color: "var(--color-muted)" }}>Loading…</p>
        </div>
      }
    >
      <LoginPageInner />
    </Suspense>
  );
}
