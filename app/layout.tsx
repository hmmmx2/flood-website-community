import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FloodWatch Community",
  description: "Community flood updates, alerts, and discussions for Malaysia",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
