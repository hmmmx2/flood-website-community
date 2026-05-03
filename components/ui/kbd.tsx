import type { ReactNode } from "react";

/** Keyboard hint pill — matches [shadcn/ui Kbd](https://ui.shadcn.com/docs/components/kbd) styling. */
export function Kbd({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <kbd
      className={`pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded-md border border-[var(--color-border)] bg-[var(--color-pill-bg)] px-1.5 font-mono text-[10px] font-medium text-[var(--color-muted)] ${className}`}
    >
      {children}
    </kbd>
  );
}
