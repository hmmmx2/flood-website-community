"use client";

/**
 * /verify-email — second step of the registration flow.
 *
 * Modern OTP UI: six separated digit boxes with auto-advance, paste support,
 * arrow-key navigation, and animated success/error feedback. After
 * /api/auth/verify-email succeeds we install the NextAuth session via the
 * token-based "admin-token" provider so the user lands signed-in on the home
 * page without retyping their password.
 */

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { AuthFooter, AuthTopNav } from "@/components/auth/AuthChrome";

const CODE_LEN = 6;
const RESEND_COOLDOWN_S = 30;

type VerifyEmailResponse = {
  session?: { accessToken?: string; refreshToken?: string };
  user?: { id?: string; email?: string };
};

type Status = "idle" | "submitting" | "success" | "error";

function VerifyEmailInner() {
  const router = useRouter();
  const params = useSearchParams();
  const emailParam = params.get("email") ?? "";
  const devCodeParam = params.get("devCode") ?? "";

  const [email, setEmail] = useState(emailParam);
  const [digits, setDigits] = useState<string[]>(() =>
    seedDigits(devCodeParam),
  );
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [info, setInfo] = useState(
    devCodeParam ? "Dev mode — code prefilled from server response." : "",
  );
  const [resendIn, setResendIn] = useState(0);
  const [resending, setResending] = useState(false);

  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);
  const code = useMemo(() => digits.join(""), [digits]);
  const isComplete = code.length === CODE_LEN && /^\d{6}$/.test(code);

  useEffect(() => {
    // focus first empty box on mount
    const idx = digits.findIndex((d) => !d);
    inputsRef.current[idx === -1 ? CODE_LEN - 1 : idx]?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const setDigitAt = useCallback((idx: number, value: string) => {
    setDigits((prev) => {
      const next = [...prev];
      next[idx] = value;
      return next;
    });
  }, []);

  function handleChange(idx: number) {
    return (e: ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value.replace(/\D/g, "");
      if (status === "error") {
        setStatus("idle");
        setError("");
      }
      if (raw.length === 0) {
        setDigitAt(idx, "");
        return;
      }
      // Pasted multi-digit value into one box — distribute it
      if (raw.length > 1) {
        const chars = raw.slice(0, CODE_LEN - idx).split("");
        setDigits((prev) => {
          const next = [...prev];
          chars.forEach((c, i) => (next[idx + i] = c));
          return next;
        });
        const target = Math.min(idx + chars.length, CODE_LEN - 1);
        inputsRef.current[target]?.focus();
        return;
      }
      setDigitAt(idx, raw);
      if (idx < CODE_LEN - 1) inputsRef.current[idx + 1]?.focus();
    };
  }

  function handleKeyDown(idx: number) {
    return (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Backspace") {
        if (digits[idx]) {
          setDigitAt(idx, "");
          return;
        }
        if (idx > 0) {
          inputsRef.current[idx - 1]?.focus();
          setDigitAt(idx - 1, "");
        }
      } else if (e.key === "ArrowLeft" && idx > 0) {
        inputsRef.current[idx - 1]?.focus();
      } else if (e.key === "ArrowRight" && idx < CODE_LEN - 1) {
        inputsRef.current[idx + 1]?.focus();
      }
    };
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
    const raw = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, CODE_LEN);
    if (!raw) return;
    e.preventDefault();
    const next = Array.from({ length: CODE_LEN }, (_, i) => raw[i] ?? "");
    setDigits(next);
    inputsRef.current[Math.min(raw.length, CODE_LEN - 1)]?.focus();
  }

  async function submitCode(currentCode: string) {
    setError("");
    setInfo("");
    setStatus("submitting");
    try {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          code: currentCode,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as VerifyEmailResponse & {
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || "Verification failed.");

      setStatus("success");

      const accessToken = data.session?.accessToken;
      const refreshToken = data.session?.refreshToken;
      if (accessToken && refreshToken) {
        const result = await signIn("admin-token", {
          accessToken,
          refreshToken,
          redirect: false,
        });
        if (!result?.error) {
          setTimeout(() => router.push("/"), 900);
          return;
        }
      }
      setInfo("Account verified. Sign in below to continue.");
      setTimeout(() => router.push("/login"), 1100);
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Verification failed.");
      setTimeout(() => {
        setStatus((s) => (s === "error" ? "idle" : s));
        setDigits(Array(CODE_LEN).fill(""));
        inputsRef.current[0]?.focus();
      }, 900);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!isComplete || status === "submitting") return;
    void submitCode(code);
  }

  async function handleResend() {
    if (resending || resendIn > 0 || !email) return;
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
      setInfo("A fresh code has been sent. Check your inbox.");
      setResendIn(RESEND_COOLDOWN_S);
      setDigits(Array(CODE_LEN).fill(""));
      inputsRef.current[0]?.focus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't resend code.");
    } finally {
      setResending(false);
    }
  }

  return (
    <div
      className="flex min-h-screen flex-col"
      style={{ background: "var(--color-bg)" }}
    >
      <AuthTopNav />
      <div className="flex flex-1 flex-col items-center justify-center p-6 pt-20 sm:pt-24">
        <div
          className="w-full max-w-md rounded-3xl border p-8 shadow-lg"
          style={{
            background: "var(--color-card)",
            borderColor: "var(--color-border)",
          }}
        >
          <div className="flex justify-center mb-5">
            <Image
              src="/images/logo.png"
              alt="FloodWatch"
              width={56}
              height={56}
              priority
            />
          </div>

          <div className="text-center mb-7">
            <h2
              className="text-2xl font-semibold mb-2 tracking-tight"
              style={{ color: "var(--color-text)" }}
            >
              Verify your email
            </h2>
            <p
              className="text-sm leading-relaxed"
              style={{ color: "var(--color-muted)" }}
            >
              We sent a 6-digit code to{" "}
              <span
                className="font-medium"
                style={{ color: "var(--color-text)" }}
              >
                {email || "your email"}
              </span>
              .
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            {!emailParam && (
              <div className="mb-5">
                <label
                  className="block text-sm font-medium mb-2"
                  style={{ color: "var(--color-text)" }}
                >
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                  className="w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition focus:ring-2"
                  style={{
                    background: "var(--color-input-bg)",
                    borderColor: "var(--color-border)",
                    color: "var(--color-text)",
                  }}
                />
              </div>
            )}

            <div
              className="flex items-center justify-between gap-2 sm:gap-3 mb-3"
              onPaste={handlePaste}
            >
              {digits.map((d, idx) => (
                <input
                  key={idx}
                  ref={(el) => {
                    inputsRef.current[idx] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={1}
                  value={d}
                  onChange={handleChange(idx)}
                  onKeyDown={handleKeyDown(idx)}
                  disabled={status === "submitting" || status === "success"}
                  aria-label={`Digit ${idx + 1}`}
                  className={[
                    "h-14 w-full sm:h-16 rounded-xl border text-center text-2xl font-semibold outline-none transition-all",
                    "focus:ring-2 focus:ring-offset-0 focus:border-[var(--color-brand)] focus:ring-[var(--color-brand)]/30",
                    status === "error"
                      ? "border-red-400 ring-2 ring-red-400/30 animate-[shake_0.4s_ease-in-out]"
                      : status === "success"
                        ? "border-emerald-400 ring-2 ring-emerald-400/30"
                        : d
                          ? "border-[var(--color-brand)]/50"
                          : "border-[var(--color-border)]",
                  ].join(" ")}
                  style={{
                    background: "var(--color-input-bg)",
                    color: "var(--color-text)",
                  }}
                />
              ))}
            </div>

            <div className="min-h-[24px] mb-4 text-center text-sm">
              {status === "error" && error && (
                <span className="inline-flex items-center gap-1.5 text-red-600 dark:text-red-400 font-medium">
                  <CrossIcon className="h-4 w-4" />
                  {error}
                </span>
              )}
              {status === "success" && (
                <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                  <CheckIcon className="h-4 w-4" />
                  Verified — taking you in…
                </span>
              )}
              {status !== "error" && status !== "success" && info && (
                <span style={{ color: "var(--color-muted)" }}>{info}</span>
              )}
              {status === "idle" && !info && (
                <span style={{ color: "var(--color-muted)" }}>
                  Code expires in 10 minutes.
                </span>
              )}
            </div>

            <button
              type="submit"
              disabled={!isComplete || status === "submitting" || status === "success"}
              className="w-full rounded-xl px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--color-brand-dark)] disabled:opacity-50 disabled:cursor-not-allowed bg-[var(--color-brand)] flex items-center justify-center gap-2"
            >
              {status === "submitting" && <Spinner />}
              {status === "success" && <CheckIcon className="h-4 w-4" />}
              {status === "submitting"
                ? "Verifying…"
                : status === "success"
                  ? "Verified"
                  : "Verify and continue"}
            </button>
          </form>

          <div className="mt-6 flex items-center justify-between text-sm">
            <button
              type="button"
              onClick={handleResend}
              disabled={resending || resendIn > 0 || !email}
              className="font-semibold transition hover:opacity-80 text-[var(--color-brand)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {resending
                ? "Sending…"
                : resendIn > 0
                  ? `Resend in ${resendIn}s`
                  : "Resend code"}
            </button>
            <Link
              href="/login"
              className="text-[var(--color-muted)] hover:opacity-80"
            >
              ← Back to Sign In
            </Link>
          </div>
        </div>
      </div>
      <AuthFooter />
      <style jsx global>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-6px); }
          40% { transform: translateX(6px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
        }
      `}</style>
    </div>
  );
}

function seedDigits(devCode: string): string[] {
  const sane = devCode.replace(/\D/g, "").slice(0, CODE_LEN);
  return Array.from({ length: CODE_LEN }, (_, i) => sane[i] ?? "");
}

function CheckIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 10.5l4 4 8-9" />
    </svg>
  );
}

function CrossIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 5l10 10M15 5L5 15" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="3"
      />
      <path
        d="M22 12a10 10 0 0 1-10 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div
          className="flex min-h-screen items-center justify-center"
          style={{ background: "var(--color-bg)" }}
        >
          <p style={{ color: "var(--color-muted)" }}>Loading…</p>
        </div>
      }
    >
      <VerifyEmailInner />
    </Suspense>
  );
}
