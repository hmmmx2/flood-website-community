"use client";

import { forwardRef, useId } from "react";
import type { KeyboardEvent, ReactNode } from "react";

/** Shared magnifier icon (inline SVG, no extra deps). */
export function SearchGlyph({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
      className={className}
    >
      <circle cx="11" cy="11" r="7" />
      <path strokeLinecap="round" d="M16.5 16.5L21 21" />
    </svg>
  );
}

function ClearGlyph({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

const shell =
  "relative flex w-full items-center rounded-lg border border-[var(--color-border)] bg-[var(--color-input-bg)] shadow-sm transition-[color,box-shadow,border-color]";

const focusRing =
  "focus-within:border-[var(--color-brand)] focus-within:ring-[3px] focus-within:ring-[var(--color-brand)]/15";

const inputBase =
  "w-full bg-transparent text-sm text-[var(--color-text)] placeholder:text-[var(--color-muted)] outline-none disabled:cursor-not-allowed disabled:opacity-50";

export type SearchFieldProps = {
  label?: string;
  showLabel?: boolean;
  placeholder: string;
  size?: "sm" | "md";
  className?: string;
  wrapperClassName?: string;
  clearable?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  id?: string;
  name?: string;
  dataTestId?: string;
  value: string;
  onValueChange: (next: string) => void;
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
};

export const SearchField = forwardRef<HTMLInputElement, SearchFieldProps>(function SearchField(
  {
    label,
    showLabel,
    placeholder,
    size = "md",
    className = "",
    wrapperClassName = "",
    clearable = true,
    disabled,
    autoFocus,
    id,
    name,
    dataTestId,
    value,
    onValueChange,
    onKeyDown,
  },
  ref,
) {
  const genId = useId();
  const labelId = id ?? `search-${genId}`;
  const py = size === "sm" ? "py-2" : "py-2.5";
  const iconBox = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  const pl = "pl-9";
  const pr = clearable && value ? "pr-8" : "pr-3";
  const showClear = clearable && Boolean(value);

  return (
    <div className={className}>
      {showLabel && label && (
        <label htmlFor={labelId} className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
          {label}
        </label>
      )}
      <div className={`${shell} ${focusRing} ${wrapperClassName}`}>
        <SearchGlyph className={`pointer-events-none absolute left-3 top-1/2 ${iconBox} -translate-y-1/2 text-[var(--color-muted)]`} />
        <input
          ref={ref}
          id={labelId}
          name={name}
          type="search"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
          disabled={disabled}
          autoFocus={autoFocus}
          value={value}
          data-testid={dataTestId}
          onChange={(e) => onValueChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          aria-label={!showLabel && label ? label : undefined}
          className={`${inputBase} ${py} ${pl} ${pr} rounded-lg`}
        />
        {showClear && (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => onValueChange("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-[var(--color-muted)] hover:bg-[var(--color-hover)] hover:text-[var(--color-brand)]"
            aria-label="Clear search"
          >
            <ClearGlyph className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
});

export type SearchTriggerProps = {
  placeholder: string;
  onClick: () => void;
  shortcut?: ReactNode;
  disabled?: boolean;
  className?: string;
  /** Wide pill style for desktop navbar */
  variant?: "navbar" | "icon";
  dataTestId?: string;
};

/** Opens command-palette style search; pairs with {@link SearchField} visually. */
export function SearchTrigger({
  placeholder,
  onClick,
  shortcut,
  disabled,
  className = "",
  variant = "navbar",
  dataTestId,
}: SearchTriggerProps) {
  const tid = dataTestId ?? (variant === "navbar" ? "search-trigger" : "search-trigger-icon");
  const genId = useId();
  const btnId = `search-trigger-${genId}`;

  if (variant === "icon") {
    return (
      <button
        type="button"
        id={btnId}
        data-testid={tid}
        onClick={onClick}
        disabled={disabled}
        className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-[var(--color-border)] text-[var(--color-muted)] shadow-sm transition hover:border-[var(--color-brand)] hover:bg-[var(--color-hover)] hover:text-[var(--color-brand)] disabled:opacity-50 ${className}`}
        aria-label={placeholder}
      >
        <SearchGlyph className="h-4 w-4" />
      </button>
    );
  }

  return (
    <button
      type="button"
      id={btnId}
      data-testid={tid}
      onClick={onClick}
      disabled={disabled}
      className={`flex min-h-10 w-full min-w-0 max-w-xs flex-1 items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-input-bg)] px-4 py-2 text-left text-sm text-[var(--color-muted)] shadow-sm transition hover:border-[var(--color-brand)] hover:bg-[var(--color-hover)] disabled:opacity-50 ${className}`}
    >
      <SearchGlyph className="h-4 w-4 flex-shrink-0" />
      <span className="min-w-0 flex-1 truncate">{placeholder}</span>
      {shortcut != null && <span className="ml-auto flex-shrink-0">{shortcut}</span>}
    </button>
  );
}
