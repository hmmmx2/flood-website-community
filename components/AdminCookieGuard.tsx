"use client";

import { useEffect } from "react";
import { signOut, useSession } from "next-auth/react";

/** Clears legacy NextAuth cookies where role was admin — community is end-user only. */
export default function AdminCookieGuard() {
  const { data, status } = useSession();

  useEffect(() => {
    if (status !== "authenticated" || !data?.user) return;
    const role = (data.user as { role?: string }).role?.toLowerCase();
    if (role === "admin") {
      void signOut({ redirect: false });
    }
  }, [status, data]);

  return null;
}
