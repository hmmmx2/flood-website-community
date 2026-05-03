import type { Metadata } from "next";
import Script from "next/script";
import { cookies } from "next/headers";
import "./globals.css";
import { SessionProvider } from "next-auth/react";
import { Toaster } from "react-hot-toast";
import AdminCookieGuard from "@/components/AdminCookieGuard";
import { SensorStreamProvider } from "@/components/providers/SensorStreamProvider";
import { ThemeProvider } from "@/lib/theme/ThemeProvider";
import { getThemeInitScript } from "@/lib/theme/themeScript";

export const metadata: Metadata = {
  title: "FloodWatch Community",
  description: "Community flood updates, alerts, and discussions for Malaysia",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const t = cookieStore.get("flood-theme")?.value;
  const htmlClass = t === "dark" ? "dark" : t === "light" ? "" : undefined;

  return (
    <html lang="en" suppressHydrationWarning className={htmlClass}>
      <body>
        <Script
          id="flood-theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: getThemeInitScript() }}
        />
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-[var(--color-card)] focus:rounded focus:shadow focus:text-[var(--color-brand)] focus:font-semibold focus:text-sm"
        >
          Skip to main content
        </a>
        <ThemeProvider>
          <SessionProvider>
            <SensorStreamProvider>
              <AdminCookieGuard />
              <div id="main-content">{children}</div>
              <Toaster position="top-center" toastOptions={{ duration: 3500 }} />
            </SensorStreamProvider>
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
