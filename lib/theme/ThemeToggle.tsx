"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import type { ComponentType } from "react";
import { useTheme } from "./ThemeProvider";
import type { ThemePreference } from "./ThemeProvider";

type Props = { className?: string; compact?: boolean };

function SunIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  );
}

/** Laptop / system — matches shadcn “system” option icon style. */
function MonitorIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <rect width="20" height="14" x="2" y="3" rx="2" />
      <path d="M8 21h8m-4-4v4" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden>
      <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden>
      <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TriggerIcon({ theme, isDark }: { theme: ThemePreference; isDark: boolean }) {
  if (theme === "system") {
    return <MonitorIcon className="h-[1.15rem] w-[1.15rem]" />;
  }
  return isDark ? <MoonIcon className="h-[1.15rem] w-[1.15rem]" /> : <SunIcon className="h-[1.15rem] w-[1.15rem]" />;
}

/**
 * shadcn-style appearance menu: Light / Dark / System (Radix DropdownMenu).
 * Uses Flood design tokens; syncs with ThemeProvider (`setTheme`).
 */
export function ThemeToggle({ className = "", compact = false }: Props) {
  const { theme, setTheme, isDark } = useTheme();

  const ringOffset = isDark
    ? "focus-visible:ring-offset-[var(--color-dark-bg)]"
    : "focus-visible:ring-offset-[var(--color-bg)]";

  const triggerBase =
    "group relative inline-flex shrink-0 items-center justify-center rounded-md border shadow-sm transition-colors duration-200 outline-none " +
    "focus-visible:ring-2 focus-visible:ring-[var(--color-primary-blue)]/55 focus-visible:ring-offset-2 " +
    ringOffset + " " +
    (isDark
      ? "border-[var(--color-dark-border)] bg-[var(--color-dark-card)] text-[var(--color-dark-text-secondary)] hover:border-[var(--color-primary-blue)]/50 hover:bg-[var(--color-dark-card-alt)] hover:text-[var(--color-dark-text)] data-[state=open]:border-[var(--color-primary-blue)]/40"
      : "border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-muted)] hover:border-[var(--color-primary-blue)]/40 hover:bg-[var(--color-hover)] hover:text-[var(--color-text)] data-[state=open]:border-[var(--color-primary-blue)]/30");

  const contentClass =
    "z-[100] min-w-[10rem] overflow-hidden rounded-md border border-[var(--color-border)] bg-[var(--color-card)] p-1 shadow-md " +
    "dark:border-[var(--color-dark-border)] dark:bg-[var(--color-dark-card)]";

  const itemClass =
    "relative flex cursor-pointer select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none " +
    "text-[var(--color-text)] focus:bg-[var(--color-hover)] data-[highlighted]:bg-[var(--color-hover)] " +
    "dark:text-[var(--color-dark-text)] dark:focus:bg-[var(--color-dark-card-alt)] dark:data-[highlighted]:bg-[var(--color-dark-card-alt)]";

  const optionRow = (value: ThemePreference, label: string, Icon: ComponentType<{ className?: string }>) => (
    <DropdownMenu.Item
      key={value}
      className={itemClass}
      onSelect={() => setTheme(value)}
    >
      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center text-[var(--color-brand)]">
        {theme === value ? <CheckIcon className="h-3.5 w-3.5" /> : null}
      </span>
      <Icon className="mr-2 h-4 w-4 shrink-0 opacity-70" />
      {label}
    </DropdownMenu.Item>
  );

  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label="Theme menu"
          className={[triggerBase, compact ? "h-9 w-9" : "h-10 gap-1.5 px-3 sm:min-w-[7rem] sm:justify-between", className].join(" ")}
        >
          <span className="inline-flex items-center gap-2">
            <TriggerIcon theme={theme} isDark={isDark} />
            {!compact && (
              <span
                className={`hidden text-xs font-medium sm:inline ${
                  isDark ? "text-[var(--color-dark-text-secondary)]" : "text-[var(--color-muted)]"
                }`}
              >
                Theme
              </span>
            )}
          </span>
          <ChevronDownIcon className={`h-3.5 w-3.5 shrink-0 opacity-60 ${compact ? "hidden" : "hidden sm:block"}`} />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content className={contentClass} sideOffset={6} align="end" collisionPadding={8}>
          {optionRow("light", "Light", SunIcon)}
          {optionRow("dark", "Dark", MoonIcon)}
          {optionRow("system", "System", MonitorIcon)}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
