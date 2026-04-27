"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { saveSession } from "@/lib/auth";
import type { AuthUser } from "@/lib/auth";

export default function AuthCallbackPage() {
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

    try {
      const user: AuthUser = JSON.parse(atob(u));
      saveSession({ accessToken: at, refreshToken: rt }, user);
      // Remove tokens from URL immediately (security: no browser history leak)
      window.history.replaceState({}, "", "/");
      router.replace("/");
    } catch {
      router.replace("/login");
    }
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
