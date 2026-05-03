"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { dispatchThemeChange } from "./useThemeTokens";
import { FLOOD_THEME_KEY } from "./themeScript";

export type ThemePreference = "light" | "dark" | "system";

type Ctx = {
  theme: ThemePreference;
  effectiveTheme: "light" | "dark";
  setTheme: (t: ThemePreference) => void;
  toggleTheme: () => void;
  isDark: boolean;
};

const ThemeCtx = createContext<Ctx | undefined>(undefined);

const ONE_YEAR = 60 * 60 * 24 * 365;

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const hit = document.cookie.split("; ").find((row) => row.startsWith(name + "="));
  if (!hit) return null;
  return decodeURIComponent(hit.slice(name.length + 1));
}

function writeCookie(name: string, value: string): void {
  document.cookie = `${name}=${encodeURIComponent(value)};path=/;max-age=${ONE_YEAR};SameSite=Lax`;
}

function systemIsDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function resolveEffective(pref: ThemePreference): "light" | "dark" {
  if (pref === "dark") return "dark";
  if (pref === "light") return "light";
  return systemIsDark() ? "dark" : "light";
}

function applyDom(pref: ThemePreference, notify: boolean): void {
  const effective = resolveEffective(pref);
  document.documentElement.classList.toggle("dark", effective === "dark");
  document.documentElement.classList.add("theme-anim");
  window.setTimeout(() => {
    document.documentElement.classList.remove("theme-anim");
  }, 280);
  try {
    localStorage.setItem(FLOOD_THEME_KEY, pref);
  } catch {
    /* ignore */
  }
  writeCookie(FLOOD_THEME_KEY, pref);
  if (notify) {
    dispatchThemeChange();
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemePreference>("system");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    let initial: ThemePreference = "system";
    try {
      const fromCookie = readCookie(FLOOD_THEME_KEY) as ThemePreference | null;
      const fromStorage = localStorage.getItem(FLOOD_THEME_KEY) as ThemePreference | null;
      if (fromCookie === "light" || fromCookie === "dark" || fromCookie === "system") {
        initial = fromCookie;
      } else if (fromStorage === "light" || fromStorage === "dark" || fromStorage === "system") {
        initial = fromStorage;
      }
    } catch {
      /* ignore */
    }
    // Client-only: sync React state with cookie/storage after mount (SSR has no document/storage).
    /* eslint-disable react-hooks/set-state-in-effect -- intentional one-time hydration */
    setTheme(initial);
    applyDom(initial, false);
    setMounted(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (!mounted || theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyDom("system", true);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [mounted, theme]);

  const setThemeWrapped = useCallback((t: ThemePreference) => {
    setTheme(t);
    applyDom(t, true);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const eff = resolveEffective(prev);
      const next: ThemePreference = eff === "dark" ? "light" : "dark";
      applyDom(next, true);
      return next;
    });
  }, []);

  const effectiveTheme = mounted ? resolveEffective(theme) : "light";

  const value = useMemo<Ctx>(
    () => ({
      theme,
      effectiveTheme,
      setTheme: setThemeWrapped,
      toggleTheme,
      isDark: effectiveTheme === "dark",
    }),
    [theme, effectiveTheme, setThemeWrapped, toggleTheme],
  );

  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export function useTheme(): Ctx {
  const ctx = useContext(ThemeCtx);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
