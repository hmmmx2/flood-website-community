"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Site-wide command palette: Ctrl/Cmd+K plus programmatic open/close.
 * Use with {@link Navbar} `onSearchOpen={openSearch}` and {@link SearchModal}.
 */
export function useSiteSearchModal() {
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const openSearch = useCallback(() => setSearchOpen(true), []);
  const closeSearch = useCallback(() => setSearchOpen(false), []);

  return { searchOpen, setSearchOpen, openSearch, closeSearch };
}
