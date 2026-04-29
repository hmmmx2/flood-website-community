"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import PostCard from "@/components/PostCard";
import CreatePostModal from "@/components/CreatePostModal";
import SearchModal from "@/components/SearchModal";
import Footer from "@/components/Footer";
import { getToken, getUser, clearSession, getInitials } from "@/lib/auth";
import { authFetch } from "@/lib/authFetch";
import type { Post, PagedPosts, Group } from "@/lib/types";
import type { AuthUser } from "@/lib/auth";

type SortKey = "new" | "top";

export default function HomePage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [sort, setSort] = useState<SortKey>("new");
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  // UX-POST01: inline delete confirmation (replaces native confirm())
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  // FEAT-03: login-gating snackbar for unauthenticated action attempts
  const [showLoginSnack, setShowLoginSnack] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    setUser(getUser());
    setToken(getToken());
  }, []);

  // WEB-029: auto-open create modal when ?create=1
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("create") === "1" && getToken()) {
      setCreateOpen(true);
      window.history.replaceState({}, "", "/");
    }
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") { e.preventDefault(); setSearchOpen(true); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    authFetch("/api/groups")
      .then(r => r.ok ? r.json() : [])
      .then((data: Group[]) => setGroups(data))
      .catch(() => {});
  }, []);

  const fetchPosts = useCallback(async (p: number, s: SortKey, replace: boolean) => {
    if (replace) { setLoading(true); setFetchError(false); } else setLoadingMore(true);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    try {
      // authFetch automatically refreshes the access token on 401/403 so that
      // likedByMe / joinedByMe are always resolved against the correct viewer.
      const res = await authFetch(`/api/posts?page=${p}&size=10&sort=${s}`, { signal: controller.signal });
      if (!res.ok) { if (replace) setFetchError(true); return; }
      const data: PagedPosts = await res.json();
      setPosts(prev => replace ? data.content : [...prev, ...data.content]);
      setHasMore(!data.last);
      setPage(p);
    } catch {
      if (replace) setFetchError(true);
    } finally {
      clearTimeout(timer);
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    fetchPosts(0, sort, true);
  }, [sort, fetchPosts]);

  function showLoginHint() {
    setShowLoginSnack(true);
    setTimeout(() => setShowLoginSnack(false), 3500);
  }

  function showActionError(msg: string) {
    setActionError(msg);
    setTimeout(() => setActionError(null), 3500);
  }

  async function handleLike(postId: string) {
    // FEAT-03: show snackbar instead of redirecting so the user keeps context
    if (!getToken()) { showLoginHint(); return; }
    const res = await authFetch(`/api/posts/${postId}/like`, { method: "POST" });
    if (!res.ok) { showActionError("Failed to update like. Please try again."); return; }
    const data: { liked: boolean; likesCount: number } = await res.json();
    setPosts(prev => prev.map(p => p.id === postId
      ? { ...p, likedByMe: data.liked, likesCount: data.likesCount }
      : p));
  }

  async function handleDelete(postId: string) {
    // UX-POST01: two-step inline confirmation — first call arms it, second confirms
    if (pendingDeleteId !== postId) { setPendingDeleteId(postId); return; }
    setPendingDeleteId(null);
    if (!getToken()) return;
    const res = await authFetch(`/api/posts/${postId}`, { method: "DELETE" });
    if (res.ok || res.status === 204) {
      setPosts(prev => prev.filter(p => p.id !== postId));
    } else {
      showActionError("Failed to delete post. Please try again.");
    }
  }

  function handleLogout() {
    clearSession();
    setUser(null);
    setToken(null);
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      {/* UX-POST01 — inline delete confirmation toast */}
      {pendingDeleteId && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 rounded-2xl bg-white border border-red-200 shadow-xl px-5 py-3 animate-in slide-in-from-bottom-4">
          <span className="text-sm font-medium text-gray-700">Delete this post?</span>
          <button
            type="button"
            onClick={() => handleDelete(pendingDeleteId)}
            className="text-sm font-bold text-red-600 hover:text-red-700 transition-colors"
          >
            Delete
          </button>
          <button
            type="button"
            onClick={() => setPendingDeleteId(null)}
            className="text-sm font-medium text-gray-400 hover:text-gray-600 transition-colors"
          >
            Cancel
          </button>
        </div>
      )}
      {/* Action error snackbar */}
      {actionError && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-2xl bg-red-600 text-white shadow-xl px-5 py-3 animate-in slide-in-from-bottom-4">
          <span className="text-sm">{actionError}</span>
        </div>
      )}
      {/* FEAT-03 — login-gating snackbar for guest interactions */}
      {showLoginSnack && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-2xl bg-gray-900 text-white shadow-xl px-5 py-3 animate-in slide-in-from-bottom-4">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 flex-shrink-0 text-[var(--color-brand)]">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <span className="text-sm">Sign in to like, comment and post</span>
          <Link href="/login" className="text-sm font-bold text-[var(--color-brand)] hover:text-[var(--color-brand-dark)] transition-colors flex-shrink-0">
            Sign In →
          </Link>
        </div>
      )}
      <Navbar
        user={user}
        onLogout={handleLogout}
        onSearchOpen={() => setSearchOpen(true)}
        activeLink="community"
      />

      <main className="mx-auto max-w-5xl px-4 py-6 flex gap-6">
        {/* Feed column */}
        <div className="flex-1 min-w-0">
          {/* Create post bar */}
          {user ? (
            <div className="bg-white border border-[var(--color-border)] rounded-2xl flex items-center gap-3 p-3 mb-4">
              <div className="h-9 w-9 rounded-full bg-[var(--color-brand)] flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                {getInitials(user.displayName)}
              </div>
              <button type="button" onClick={() => setCreateOpen(true)}
                className="flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] px-4 py-2 text-sm text-[var(--color-muted)] text-left hover:border-[var(--color-brand)] hover:bg-white transition">
                Share a flood update…
              </button>
              <button type="button" onClick={() => setCreateOpen(true)}
                className="flex-shrink-0 rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] p-2 hover:border-[var(--color-brand)] transition text-[var(--color-muted)]"
                title="Upload image">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M2.25 6.75h19.5M3.75 6.75A1.5 1.5 0 002.25 8.25v11.25a1.5 1.5 0 001.5 1.5h15a1.5 1.5 0 001.5-1.5V8.25a1.5 1.5 0 00-1.5-1.5H3.75z" />
                </svg>
              </button>
            </div>
          ) : (
            <div className="bg-white border border-[var(--color-border)] rounded-2xl p-4 mb-4 text-center">
              <p className="text-sm text-[var(--color-muted)] mb-3">Join the community to share flood updates and stay informed.</p>
              <div className="flex gap-2 justify-center">
                <Link href="/login" className="rounded-full border border-[var(--color-brand)] px-5 py-2 text-sm font-bold text-[var(--color-brand)] hover:bg-blue-50 transition">Log In</Link>
                <Link href="/register" className="rounded-full bg-[var(--color-brand)] px-5 py-2 text-sm font-bold text-white hover:bg-[var(--color-brand-dark)] transition">Sign Up</Link>
              </div>
            </div>
          )}

          {/* Sort tabs */}
          <div className="bg-white border border-[var(--color-border)] rounded-2xl flex items-center gap-1 p-1.5 mb-4">
            {(["new", "top"] as const).map(s => (
              <button key={s} type="button" onClick={() => setSort(s)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-colors capitalize ${
                  sort === s
                    ? "bg-[var(--color-pill-bg)] text-[var(--color-text)]"
                    : "text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-hover)]"
                }`}>
                {s === "new" ? (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                    <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zM12.75 6a.75.75 0 00-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 000-1.5h-3.75V6z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                    <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" />
                  </svg>
                )}
                {s === "new" ? "New" : "Top"}
              </button>
            ))}
          </div>

          {/* Posts */}
          {loading ? (
            <div className="flex flex-col gap-3">
              {[1,2,3].map(i => (
                <div key={i} className="bg-white border border-[var(--color-border)] rounded-2xl h-40 animate-pulse" />
              ))}
            </div>
          ) : fetchError ? (
            <div className="bg-white border border-[var(--color-border)] rounded-2xl p-12 text-center">
              <div className="text-4xl mb-3">⚠️</div>
              <h3 className="font-bold text-[var(--color-text)] mb-1">Could not load posts</h3>
              <p className="text-sm text-[var(--color-muted)] mb-4">The server may still be starting up. Please try again.</p>
              <button type="button" onClick={() => fetchPosts(0, sort, true)}
                className="rounded-full bg-[var(--color-brand)] px-5 py-2 text-sm font-bold text-white hover:bg-[var(--color-brand-dark)] transition">
                Retry
              </button>
            </div>
          ) : posts.length === 0 ? (
            <div className="bg-white border border-[var(--color-border)] rounded-2xl p-12 text-center">
              <div className="text-4xl mb-3">🌊</div>
              <h3 className="font-bold text-[var(--color-text)] mb-1">No posts yet</h3>
              <p className="text-sm text-[var(--color-muted)]">Be the first to share a flood update!</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {posts.map(post => (
                <PostCard
                  key={post.id}
                  post={post}
                  currentUserId={user?.id}
                  token={token ?? undefined}
                  onLike={handleLike}
                  onDelete={handleDelete}
                  onEdit={(postId, updated) => setPosts(prev => prev.map(p => p.id === postId ? { ...p, ...updated } : p))}
                />
              ))}
              {hasMore && (
                <button type="button" onClick={() => fetchPosts(page + 1, sort, false)} disabled={loadingMore}
                  className="w-full py-3 rounded-2xl bg-white border border-[var(--color-border)] text-sm font-semibold text-[var(--color-brand)] hover:bg-blue-50 transition disabled:opacity-50">
                  {loadingMore ? "Loading…" : "Load more"}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <aside className="hidden lg:flex flex-col gap-4 w-72 flex-shrink-0">
          {/* About card */}
          <div className="bg-[var(--color-brand)] rounded-2xl p-4 text-white">
            <div className="flex items-center gap-2 mb-3">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                <path fillRule="evenodd" d="M11.54 22.351l.07.04.028.016a.76.76 0 00.723 0l.028-.015.071-.041a16.975 16.975 0 001.144-.742 19.58 19.58 0 002.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 00-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 002.682 2.282 16.975 16.975 0 001.145.742z" clipRule="evenodd" />
              </svg>
              <h3 className="font-bold">FloodWatch Community</h3>
            </div>
            <p className="text-sm text-white/90 mb-4">A community for Malaysians to share real-time flood updates, safety tips, and support each other.</p>
            {user ? (
              <button type="button" onClick={() => setCreateOpen(true)}
                className="w-full rounded-full bg-white text-[var(--color-brand)] py-2 text-sm font-bold hover:bg-white/90 transition">
                Create Post
              </button>
            ) : (
              <Link href="/login" className="block w-full text-center rounded-full bg-white text-[var(--color-brand)] py-2 text-sm font-bold hover:bg-white/90 transition">
                Join Community
              </Link>
            )}
          </div>

          {/* Groups */}
          {groups.length > 0 && (
            <div className="bg-white border border-[var(--color-border)] rounded-2xl p-4">
              <h3 className="font-bold text-[var(--color-text)] mb-3 flex items-center justify-between">
                <span>Communities</span>
                <span className="text-xs font-normal text-[var(--color-muted)]">{groups.length} groups</span>
              </h3>
              <div className="space-y-2">
                {groups.slice(0, 6).map(g => (
                  <Link key={g.id} href={`/g/${g.slug}`}
                    className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-[var(--color-hover)] transition group">
                    <div className="h-8 w-8 rounded-lg flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                      style={{ backgroundColor: g.iconColor || "var(--color-brand)" }}>
                      {g.iconLetter}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[var(--color-text)] truncate group-hover:text-[var(--color-brand)] transition-colors">
                        g/{g.slug}
                      </p>
                      <p className="text-xs text-[var(--color-muted)]">{g.membersCount.toLocaleString()} members</p>
                    </div>
                    {g.joinedByMe && (
                      <span className="text-[10px] font-bold text-[var(--color-brand)] bg-blue-50 px-1.5 py-0.5 rounded-full flex-shrink-0">
                        Joined
                      </span>
                    )}
                  </Link>
                ))}
                {groups.length > 6 && (
                  <p className="text-xs text-center text-[var(--color-muted)] pt-1">
                    +{groups.length - 6} more communities
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Community rules */}
          <div className="bg-white border border-[var(--color-border)] rounded-2xl p-4">
            <h3 className="font-bold text-[var(--color-text)] mb-3">Community Rules</h3>
            <ol className="space-y-2 text-sm text-[var(--color-muted)]">
              {[
                "Share accurate flood information only",
                "Be respectful and supportive",
                "No misinformation or fake alerts",
                "Include location when reporting floods",
                "Credit sources for official info",
              ].map((rule, i) => (
                <li key={i} className="flex gap-2">
                  <span className="font-bold text-[var(--color-brand)] flex-shrink-0">{i + 1}.</span>
                  <span>{rule}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Emergency contacts */}
          <div className="bg-white border border-[var(--color-border)] rounded-2xl p-4">
            <h3 className="font-bold text-[var(--color-text)] mb-3">Emergency Contacts</h3>
            <div className="space-y-2 text-sm">
              {[
                { name: "Civil Defence (APM)", number: "991" },
                { name: "Police", number: "999" },
                { name: "Bomba", number: "994" },
                { name: "JPS Flood Hotline", number: "1800-88-2773" },
              ].map(c => (
                <div key={c.name} className="flex justify-between">
                  <span className="text-[var(--color-muted)]">{c.name}</span>
                  <a href={`tel:${c.number}`} className="font-bold text-[var(--color-brand)]">{c.number}</a>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </main>

      <Footer />

      {createOpen && token && (
        <CreatePostModal
          token={token}
          onClose={() => setCreateOpen(false)}
          onCreated={post => setPosts(prev => [post as Post, ...prev])}
        />
      )}

      {searchOpen && <SearchModal onClose={() => setSearchOpen(false)} />}
    </div>
  );
}
