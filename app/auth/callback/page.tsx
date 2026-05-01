"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const at = searchParams.get("at");
    const rt = searchParams.get("rt");

    if (!at) {
      router.replace("/login");
      return;
    }

    // Validate the provided Spring Boot token against /profile and create a NextAuth session
    signIn("admin-token", {
      accessToken: at,
      refreshToken: rt ?? "",
      redirect: false,
    })
      .then((result) => {
        if (result?.ok) {
          window.history.replaceState({}, "", "/");
          router.replace("/");
        } else {
          router.replace("/login?error=invalid_session");
        }
      })
      .catch(() => {
        router.replace("/login?error=invalid_session");
      });
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
