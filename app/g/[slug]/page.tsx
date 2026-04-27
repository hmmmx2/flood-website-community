"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import PostCard from "@/components/PostCard";
import CreatePostModal from "@/components/CreatePostModal";
import { getToken, getUser, clearSession, getInitials } from "@/lib/auth";
import type { Post, PagedPosts, Group } from "@/lib/types";
import type { AuthUser } from "@/lib/auth";

type SortKey = "new" | "top";

export default function GroupPage() {
  const params = useParams();
  const slug = params.slug as string;
  const router = useRouter();

  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [group, setGroup] = useState<Group | null>(null);
  const [groupLoading, setGroupLoading] = useState(true);
  const [posts, setPosts] = useState<Post[]>([]);
  const [sort, setSort] = useState<SortKey>("new");
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [joinLoading, setJoinLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    setUser(getUser());
    setToken(getToken());
  }, []);

  // Fetch group info
  useEffect(() => {
    const t = getToken();
    const headers: Record<string, string> = {};
    if (t) headers["Authorization"] = `Bearer ${t}`;
    setGroupLoading(true);
    fetch(`/api/groups/${slug}`, { headers })
      .then(r => {
        if (r.status === 404) { setNotFound(true); return null; }
        return r.ok ? r.json() : null;
      })
      .then((data: Group | null) => {
        if (data) setGroup(data);
      })
      .finally(() => setGroupLoading(false));
  }, [slug]);

  const fetchPosts = useCallback(async (p: number, s: SortKey, replace: boolean) => {
    if (replace) setLoading(true); else setLoadingMore(true);
    try {
      const headers: Record<string, string> = {};
      const t = getToken();
      if (t) headers["Authorization"] = `Bearer ${t}`;
      const res = await fetch(`/api/posts?page=${p}&size=10&sort=${s}&group=${encodeURIComponent(slug)}`, { headers });
      if (!res.ok) return;
      const data: PagedPosts = await res.json();
      setPosts(prev => replace ? data.content : [...prev, ...data.content]);
      setHasMore(!data.last);
      setPage(p);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchPosts(0, sort, true);
  }, [sort, fetchPosts]);

  async function handleJoinToggle() {
    const t = token || getToken();
    if (!t) { router.push("/login"); return; }
    setJoinLoading(true);
    try {
      const res = await fetch(`/api/groups/${slug}/membership`, {
        method: "POST",
        headers: { Authorization: `Bearer ${t}` },
      });
      if (res.ok) {
        const data: Group = await res.json();
        setGroup(data);
      }
    } finally { setJoinLoading(false); }
  }

  async function handleLike(postId: string) {
    const t = token || getToken();
    if (!t) { router.push("/login"); return; }
    const res = await fetch(`/api/posts/${postId}/like`, {
      method: "POST",
      headers: { Authorization: `Bearer ${t}` },
    });
    if (res.ok) {
      const data: { liked: boolean; likesCount: number } = await res.json();
      setPosts(prev => prev.map(p => p.id === postId
        ? { ...p, likedByMe: data.liked, likesCount: data.likesCount }
        : p));
    }
  }

  async function handleDelete(postId: string) {
    if (!confirm("Delete this post?")) return;
    const t = token || getToken();
    if (!t) return;
    const res = await fetch(`/api/posts/${postId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${t}` },
    });
    if (res.ok || res.status === 204) {
      setPosts(prev => prev.filter(p => p.id !== postId));
    }
  }

  function handleLogout() {
    clearSession();
    setUser(null);
    setToken(null);
    setMenuOpen(false);
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-[var(--color-bg)] flex flex-col items-center justify-center gap-4">
        <div className="text-6xl">🌊</div>
        <h1 className="text-2xl font-bold text-[var(--color-text)]">Community not found</h1>
        <p className="text-[var(--color-muted)]">g/{slug} doesn&apos;t exist.</p>
        <Link href="/" className="rounded-full bg-[var(--color-brand)] px-6 py-2.5 text-sm font-bold text-white hover:bg-[var(--color-brand-dark)] transition">
          Back to Home
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      {/* Navbar */}
      <header className="sticky top-0 z-40 bg-white border-b border-[var(--color-border)] shadow-sm">
        <div className="mx-auto max-w-5xl flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 font-bold text-[var(--color-text)]">
              <div className="h-8 w-8 rounded-full bg-[var(--color-brand)] flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" className="h-4.5 w-4.5">
                  <path fillRule="evenodd" d="M11.54 22.351l.07.04.028.016a.76.76 0 00.723 0l.028-.015.071-.041a16.975 16.975 0 001.144-.742 19.58 19.58 0 002.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 00-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 002.682 2.282 16.975 16.975 0 001.145.742z" clipRule="evenodd" />
                </svg>
              </div>
              <span className="hidden sm:block text-lg">FloodWatch</span>
            </Link>
            <span className="text-[var(--color-border)]">/</span>
            <span className="text-sm font-bold text-[var(--color-text)]">g/{slug}</span>
          </div>

          <div className="flex items-center gap-2">
            {user ? (
              <div className="relative">
                <button type="button" onClick={() => setMenuOpen(o => !o)}
                  className="flex items-center gap-2 rounded-full border border-[var(--color-border)] px-3 py-1.5 hover:bg-[var(--color-hover)] transition">
                  <div className="h-6 w-6 rounded-full bg-[var(--color-brand)] flex items-center justify-center text-[10px] font-bold text-white">
                    {getInitials(user.displayName)}
                  </div>
                  <span className="text-sm font-semibold text-[var(--color-text)] hidden sm:block max-w-[120px] truncate">
                    {user.displayName}
                  </span>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-[var(--color-muted)]">
                    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                  </svg>
                </button>
                {menuOpen && (
                  <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl border border-[var(--color-border)] shadow-lg overflow-hidden z-50">
                    <button type="button" onClick={handleLogout}
                      className="w-full text-left px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition font-semibold">
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/login" className="rounded-full border border-[var(--color-brand)] px-4 py-1.5 text-sm font-bold text-[var(--color-brand)] hover:bg-red-50 transition">Log In</Link>
                <Link href="/login" className="rounded-full bg-[var(--color-brand)] px-4 py-1.5 text-sm font-bold text-white hover:bg-[var(--color-brand-dark)] transition">Sign Up</Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Group banner */}
      {!groupLoading && group && (
        <div className="border-b border-[var(--color-border)] bg-white">
          <div className="mx-auto max-w-5xl px-4 py-5 flex items-center gap-4">
            <div className="h-16 w-16 rounded-2xl flex items-center justify-center text-2xl font-bold text-white flex-shrink-0 shadow"
              style={{ backgroundColor: group.iconColor || "#ef4444" }}>
              {group.iconLetter}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-[var(--color-text)]">{group.name}</h1>
              <p className="text-sm text-[var(--color-muted)] mt-0.5">g/{group.slug} · {group.membersCount.toLocaleString()} members · {group.postsCount.toLocaleString()} posts</p>
              {group.description && (
                <p className="text-sm text-[var(--color-text)] mt-1.5 line-clamp-2">{group.description}</p>
              )}
            </div>
            <button
              type="button"
              onClick={handleJoinToggle}
              disabled={joinLoading}
              className={`flex-shrink-0 rounded-full px-5 py-2 text-sm font-bold transition disabled:opacity-50 ${
                group.joinedByMe
                  ? "border border-[var(--color-border)] text-[var(--color-text)] hover:bg-red-50 hover:text-red-600 hover:border-red-300"
                  : "bg-[var(--color-brand)] text-white hover:bg-[var(--color-brand-dark)]"
              }`}>
              {joinLoading ? "…" : group.joinedByMe ? "Leave" : "Join"}
            </button>
          </div>
        </div>
      )}

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
                Post to g/{slug}…
              </button>
            </div>
          ) : (
            <div className="bg-white border border-[var(--color-border)] rounded-2xl p-4 mb-4 text-center">
              <p className="text-sm text-[var(--color-muted)] mb-3">
                <Link href="/login" className="text-[var(--color-brand)] font-semibold hover:underline">Sign in</Link> to post in this community.
              </p>
            </div>
          )}

          {/* Sort tabs */}
          <div className="bg-white border border-[var(--color-border)] rounded-2xl flex items-center gap-1 p-1.5 mb-4">
            {(["new", "top"] as const).map(s => (
              <button key={s} type="button" onClick={() => setSort(s)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
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
          ) : posts.length === 0 ? (
            <div className="bg-white border border-[var(--color-border)] rounded-2xl p-12 text-center">
              <div className="text-4xl mb-3">📭</div>
              <h3 className="font-bold text-[var(--color-text)] mb-1">No posts yet</h3>
              <p className="text-sm text-[var(--color-muted)]">Be the first to post in this community!</p>
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
                />
              ))}
              {hasMore && (
                <button type="button" onClick={() => fetchPosts(page + 1, sort, false)} disabled={loadingMore}
                  className="w-full py-3 rounded-2xl bg-white border border-[var(--color-border)] text-sm font-semibold text-[var(--color-brand)] hover:bg-red-50 transition disabled:opacity-50">
                  {loadingMore ? "Loading…" : "Load more"}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <aside className="hidden lg:flex flex-col gap-4 w-72 flex-shrink-0">
          {/* About this community */}
          {group && (
            <div className="bg-white border border-[var(--color-border)] rounded-2xl p-4">
              <h3 className="font-bold text-[var(--color-text)] mb-2">About g/{group.slug}</h3>
              {group.description && (
                <p className="text-sm text-[var(--color-muted)] mb-4">{group.description}</p>
              )}
              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--color-muted)]">Members</span>
                  <span className="font-bold text-[var(--color-text)]">{group.membersCount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--color-muted)]">Posts</span>
                  <span className="font-bold text-[var(--color-text)]">{group.postsCount.toLocaleString()}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={user ? handleJoinToggle : () => router.push("/login")}
                disabled={joinLoading}
                className={`w-full rounded-full py-2 text-sm font-bold transition disabled:opacity-50 ${
                  group.joinedByMe
                    ? "border border-[var(--color-border)] text-[var(--color-text)] hover:bg-red-50 hover:text-red-600 hover:border-red-300"
                    : "bg-[var(--color-brand)] text-white hover:bg-[var(--color-brand-dark)]"
                }`}>
                {joinLoading ? "…" : group.joinedByMe ? "Leave Community" : "Join Community"}
              </button>
              {user && (
                <button type="button" onClick={() => setCreateOpen(true)}
                  className="w-full mt-2 rounded-full border border-[var(--color-border)] py-2 text-sm font-semibold text-[var(--color-text)] hover:bg-[var(--color-hover)] transition">
                  Create Post
                </button>
              )}
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

          {/* Back to home */}
          <Link href="/"
            className="block text-center rounded-2xl border border-[var(--color-border)] bg-white py-3 text-sm font-semibold text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-hover)] transition">
            ← Back to all communities
          </Link>
        </aside>
      </main>

      {createOpen && token && (
        <CreatePostModal
          token={token}
          defaultGroupSlug={slug}
          onClose={() => setCreateOpen(false)}
          onCreated={post => setPosts(prev => [post as Post, ...prev])}
        />
      )}
    </div>
  );
}
