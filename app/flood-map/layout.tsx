import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Flood Map · FloodWatch Community",
  description: "Live flood sensor map and node list — Sabah IoT water levels.",
};

export default function SensorsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
