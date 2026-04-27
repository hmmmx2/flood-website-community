"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import type { Post, Group } from "@/lib/types";

type Props = {
  onClose: () => void;
};

export default function SearchModal({ onClose }: Props) {
  const [query, setQuery] = useState("");
  const [posts, setPosts] = useState<Post[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) { setPosts([]); setGroups([]); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      const q = query.toLowerCase();
      try {
        const [postsRes, groupsRes] = await Promise.all([
          fetch(`/api/posts?page=0&size=50`).then(r => r.ok ? r.json() : { content: [] }),
          fetch(`/api/groups`).then(r => r.ok ? r.json() : []),
        ]);
        const matchPosts = (postsRes.content as Post[]).filter(p =>
          p.title.toLowerCase().includes(q) || p.content.toLowerCase().includes(q) || p.authorName.toLowerCase().includes(q)
        ).slice(0, 5);
        const matchGroups = (groupsRes as Group[]).filter(g =>
          g.name.toLowerCase().includes(q) || g.slug.toLowerCase().includes(q) || (g.description || "").toLowerCase().includes(q)
        ).slice(0, 4);
        setPosts(matchPosts);
        setGroups(matchGroups);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, [query]);

  const hasResults = posts.length > 0 || groups.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4 bg-black/50 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-xl bg-[var(--color-card)] rounded-2xl border border-[var(--color-border)] shadow-2xl overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[var(--color-border)]">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5 text-[var(--color-muted)] flex-shrink-0">
            <circle cx="11" cy="11" r="7" /><path strokeLinecap="round" d="M16.5 16.5L21 21" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search posts and communities…"
            className="flex-1 bg-transparent text-[var(--color-text)] placeholder:text-[var(--color-muted)] text-sm outline-none"
          />
          {loading && (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-brand)]" />
          )}
          <button type="button" onClick={onClose}
            className="text-[var(--color-muted)] hover:text-[var(--color-text)] text-xs font-semibold px-2 py-1 rounded-lg hover:bg-[var(--color-hover)] transition-colors">
            ESC
          </button>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto">
          {!query.trim() ? (
            <div className="px-4 py-8 text-center text-sm text-[var(--color-muted)]">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-8 w-8 mx-auto mb-2 opacity-40">
                <circle cx="11" cy="11" r="7" /><path strokeLinecap="round" d="M16.5 16.5L21 21" />
              </svg>
              Search posts, communities, and more
            </div>
          ) : !hasResults && !loading ? (
            <div className="px-4 py-8 text-center text-sm text-[var(--color-muted)]">
              No results for &ldquo;{query}&rdquo;
            </div>
          ) : (
            <div className="py-2">
              {/* Groups */}
              {groups.length > 0 && (
                <div>
                  <p className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--color-muted)]">Communities</p>
                  {groups.map(g => (
                    <Link key={g.id} href={`/g/${g.slug}`} onClick={onClose}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--color-hover)] transition-colors">
                      <div className="h-8 w-8 rounded-lg flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                        style={{ backgroundColor: g.iconColor || "#ed1c24" }}>
                        {g.iconLetter || g.name[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[var(--color-text)] truncate">g/{g.slug}</p>
                        <p className="text-xs text-[var(--color-muted)] truncate">{g.membersCount.toLocaleString()} members</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {/* Posts */}
              {posts.length > 0 && (
                <div>
                  <p className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--color-muted)]">Posts</p>
                  {posts.map(p => (
                    <Link key={p.id} href={`/post/${p.id}`} onClick={onClose}
                      className="flex items-start gap-3 px-4 py-2.5 hover:bg-[var(--color-hover)] transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5 text-[var(--color-muted)] flex-shrink-0 mt-0.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                      </svg>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[var(--color-text)] line-clamp-1">{p.title}</p>
                        <p className="text-xs text-[var(--color-muted)] truncate">by {p.authorName}{p.groupSlug ? ` · g/${p.groupSlug}` : ""}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer tip */}
        <div className="px-4 py-2 border-t border-[var(--color-border)] flex items-center gap-4 text-[10px] text-[var(--color-muted)]">
          <span><kbd className="font-mono bg-[var(--color-pill-bg)] px-1.5 py-0.5 rounded text-[10px]">↵</kbd> select</span>
          <span><kbd className="font-mono bg-[var(--color-pill-bg)] px-1.5 py-0.5 rounded text-[10px]">ESC</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
