"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { saveSession } from "@/lib/auth";
import type { AuthUser } from "@/lib/auth";

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const at = searchParams.get("at");
    const rt = searchParams.get("rt");
    const u = searchParams.get("u");

    if (!at || !rt || !u) {
      router.replace("/login");
      return;
    }

    const decoded = (() => {
      try { return JSON.parse(atob(u)); } catch {}
      try { return JSON.parse(decodeURIComponent(u)); } catch {}
      return null;
    })();

    if (!decoded || !decoded.id || !decoded.email || !decoded.role) {
      router.replace("/login?error=invalid_session");
      return;
    }

    const user: AuthUser = decoded as AuthUser;
    saveSession({ accessToken: at, refreshToken: rt }, user);
    window.history.replaceState({}, "", "/");
    router.replace("/");
  }, [router, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)]">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--color-border)] border-t-[var(--color-brand)]" />
        <p className="text-sm text-[var(--color-muted)]">Signing you in…</p>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)]">
          <p className="text-sm text-[var(--color-muted)]">Loading…</p>
        </div>
      }
    >
      <CallbackContent />
    </Suspense>
  );
}
