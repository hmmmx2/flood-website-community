import type { Metadata } from "next";
import "./globals.css";
import { SessionProvider } from "next-auth/react";
import { Toaster } from "react-hot-toast";

export const metadata: Metadata = {
  title: "FloodWatch Community",
  description: "Community flood updates, alerts, and discussions for Malaysia",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-white focus:rounded focus:shadow focus:text-[var(--color-brand)] focus:font-semibold focus:text-sm"
        >
          Skip to main content
        </a>
        <SessionProvider>
          <div id="main-content">{children}</div>
          <Toaster position="top-center" toastOptions={{ duration: 3500 }} />
        </SessionProvider>
      </body>
    </html>
  );
}
