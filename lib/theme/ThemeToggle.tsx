"use client";

import { useTheme } from "./ThemeProvider";

type Props = { className?: string; compact?: boolean };

export function ThemeToggle({ className = "", compact = false }: Props) {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`relative flex items-center justify-center rounded-full border transition-colors duration-200 ${
        compact ? "h-9 w-9" : "h-10 w-10 sm:h-11 sm:w-[70px] sm:justify-start"
      } ${
        isDark
          ? "border-[var(--color-dark-border)] bg-[var(--color-dark-card)] hover:border-[var(--color-primary-blue)]"
          : "border-[var(--color-light-grey)] bg-[var(--color-very-light-grey)]/50 hover:border-[var(--color-primary-blue)]"
      } ${className}`}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      <span className="text-lg leading-none">{isDark ? "☀️" : "🌙"}</span>
      {!compact && (
        <span className="ml-2 hidden text-xs font-medium text-[var(--color-dark-charcoal)] dark:text-[var(--color-dark-text-secondary)] sm:inline">
          {isDark ? "Light" : "Dark"}
        </span>
      )}
    </button>
  );
}
