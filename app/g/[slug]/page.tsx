"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Navbar from "@/components/Navbar";
import PostCard from "@/components/PostCard";
import CreatePostModal from "@/components/CreatePostModal";
import { useSession, signOut, signIn } from "next-auth/react";
import toast from "react-hot-toast";
import { sessionToAuthUser, getInitials } from "@/lib/auth";
import { authFetchJson, CommunityRequestError } from "@/lib/fetchJson";
import { showErrorToast } from "@/lib/errorToast";
import type { Post, PagedPosts, Group } from "@/lib/types";
import { WaveIcon, AlertIcon, InboxIcon } from "@/components/icons";
import SearchModal from "@/components/SearchModal";
import { SearchField } from "@/components/ui/search-field";
import { useSiteSearchModal } from "@/lib/useSiteSearchModal";
import { PAGE_CONTAINER } from "@/lib/layout";

type SortKey = "new" | "top";

export default function GroupPage() {
  const params = useParams();
  const slug = params.slug as string;

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
  const [notFound, setNotFound] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [postsError, setPostsError] = useState(false);
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);
  const { searchOpen, openSearch, closeSearch } = useSiteSearchModal();
  const [feedSearch, setFeedSearch] = useState("");
  const [debouncedFeedSearch, setDebouncedFeedSearch] = useState("");

  const { data: session } = useSession();
  const user = session?.user ? sessionToAuthUser(session.user) : null;

  useEffect(() => {
    setGroupLoading(true);
    setFetchError(false);
    void (async () => {
      try {
        const data = await authFetchJson<Group>(`/api/groups/${slug}`);
        setGroup(data);
      } catch (e) {
        if (e instanceof CommunityRequestError && e.status === 404) setNotFound(true);
        else setFetchError(true);
      } finally {
        setGroupLoading(false);
      }
    })();
  }, [slug]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedFeedSearch(feedSearch.trim()), 350);
    return () => clearTimeout(t);
  }, [feedSearch]);

  const fetchPosts = useCallback(async (p: number, s: SortKey, replace: boolean, search = "") => {
    if (replace) { setLoading(true); setPostsError(false); } else setLoadingMore(true);
    try {
      const params = new URLSearchParams({
        page: String(p),
        size: "10",
        sort: s,
        group: slug,
      });
      if (search) params.set("search", search);
      const data = await authFetchJson<PagedPosts>(`/api/posts?${params}`);
      setPosts((prev) =>
        replace
          ? Array.isArray(data.content)
            ? data.content
            : []
          : [...prev, ...(Array.isArray(data.content) ? data.content : [])],
      );
      setHasMore(!data.last);
      setPage(p);
    } catch {
      if (replace) setPostsError(true);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [slug]);

  useEffect(() => {
    setFeedSearch("");
    setDebouncedFeedSearch("");
  }, [slug]);

  useEffect(() => {
    fetchPosts(0, sort, true, debouncedFeedSearch);
  }, [sort, debouncedFeedSearch, fetchPosts]);

  async function handleJoinToggle() {
    if (!session) {
      toast("Please sign in to continue.");
      void signIn(undefined, { callbackUrl: typeof window !== "undefined" ? window.location.href : "/" });
      return;
    }
    setJoinLoading(true);
    try {
      if (group?.joinedByMe) {
        await authFetchJson(`/api/groups/${slug}/membership`, { method: "DELETE" });
        setGroup((prev) =>
          prev ? { ...prev, joinedByMe: false, membersCount: Math.max(0, prev.membersCount - 1) } : prev,
        );
        toast.success("Left community");
      } else {
        const data = await authFetchJson<Group>(`/api/groups/${slug}/membership`, { method: "POST" });
        setGroup(data);
        toast.success("Joined community");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update membership.");
    } finally {
      setJoinLoading(false);
    }
  }

  async function handleLike(postId: string) {
    if (!session) {
      toast("Please sign in to continue.");
      void signIn(undefined, { callbackUrl: typeof window !== "undefined" ? window.location.href : "/" });
      return;
    }
    try {
      const data = await authFetchJson<{ liked: boolean; likesCount: number }>(`/api/posts/${postId}/like`, {
        method: "POST",
      });
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, likedByMe: data.liked, likesCount: Math.max(0, data.likesCount) } : p,
        ),
      );
    } catch (e) {
      showErrorToast(e, "like-error", "Failed to update like.");
    }
  }

  async function handleDelete(postId: string) {
    if (deletingPostId !== postId) {
      setDeletingPostId(postId);
      return;
    }
    setDeletingPostId(null);
    if (!session) return;
    try {
      await authFetchJson(`/api/posts/${postId}`, { method: "DELETE" });
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      toast.success("Post deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete post.");
    }
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-[var(--color-bg)] flex flex-col items-center justify-center gap-4">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-[var(--color-brand)]/15 text-[var(--color-brand)]">
          <WaveIcon className="h-12 w-12" />
        </div>
        <h1 className="text-2xl font-bold text-[var(--color-text)]">Community not found</h1>
        <p className="text-[var(--color-muted)]">g/{slug} doesn&apos;t exist.</p>
        <Link href="/" className="rounded-full bg-[var(--color-brand)] px-6 py-2.5 text-sm font-bold text-white hover:bg-[var(--color-brand-dark)] transition">
          Back to Home
        </Link>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="min-h-screen bg-[var(--color-bg)] flex flex-col items-center justify-center gap-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
          <AlertIcon className="h-10 w-10" />
        </div>
        <h1 className="text-xl font-bold text-[var(--color-text)]">Failed to load community</h1>
        <p className="text-[var(--color-muted)]">The server may be unavailable. Please try again.</p>
        <button type="button" onClick={() => { setFetchError(false); setGroupLoading(true); }}
          className="rounded-full bg-[var(--color-brand)] px-6 py-2.5 text-sm font-bold text-white hover:bg-[var(--color-brand-dark)] transition">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      {/* WEB-013 — inline delete confirmation toast */}
      {deletingPostId && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 rounded-2xl bg-[var(--color-card)] border border-red-200 dark:border-red-900/50 shadow-xl px-5 py-3 animate-in slide-in-from-bottom-4">
          <span className="text-sm font-medium text-[var(--color-text)]">Delete this post?</span>
          <button type="button" onClick={() => handleDelete(deletingPostId)}
            className="text-sm font-bold text-red-600 hover:text-red-700 transition-colors">Delete</button>
          <button type="button" onClick={() => setDeletingPostId(null)}
            className="text-sm font-medium text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors">Cancel</button>
        </div>
      )}
      <Navbar
        user={user}
        onLogout={() => void signOut({ callbackUrl: "/login" })}
        onSearchOpen={openSearch}
        searchPlaceholder={`Search posts in g/${slug}…`}
        breadcrumb={{ label: `g/${slug}` }}
      />

      {/* Group banner */}
      {!groupLoading && group && (
        <div className="border-b border-[var(--color-border)] bg-[var(--color-card)]">
          <div className="mx-auto max-w-5xl px-4 py-5 flex items-center gap-4">
            <div className="h-16 w-16 rounded-2xl flex items-center justify-center text-2xl font-bold text-white flex-shrink-0 shadow"
              style={{ backgroundColor: group.iconColor || "var(--color-brand)" }}>
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
                  ? "border border-[var(--color-border)] text-[var(--color-text)] hover:bg-red-500/10 dark:hover:bg-red-950/40 hover:text-red-600 hover:border-red-400 dark:hover:border-red-800"
                  : "bg-[var(--color-brand)] text-white hover:bg-[var(--color-brand-dark)]"
              }`}>
              {joinLoading ? "…" : group.joinedByMe ? "Leave" : "Join"}
            </button>
          </div>
        </div>
      )}

      <main className={`${PAGE_CONTAINER} py-6 flex gap-6`}>
        {/* Feed column */}
        <div className="flex-1 min-w-0">
          {/* Create post bar */}
          {user ? (
            <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl flex items-center gap-3 p-3 mb-4">
              <div className="h-9 w-9 rounded-full bg-[var(--color-brand)] flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                {getInitials(user.displayName)}
              </div>
              <button type="button" onClick={() => setCreateOpen(true)}
                className="flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] px-4 py-2 text-sm text-[var(--color-muted)] text-left hover:border-[var(--color-brand)] hover:bg-[var(--color-hover)] transition">
                Post to g/{slug}…
              </button>
            </div>
          ) : (
            <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl p-4 mb-4 text-center">
              <p className="text-sm text-[var(--color-muted)] mb-3">
                <Link href="/login" className="text-[var(--color-brand)] font-semibold hover:underline">Sign in</Link> to post in this community.
              </p>
            </div>
          )}

          <div className="mb-4">
            <SearchField
              value={feedSearch}
              onValueChange={setFeedSearch}
              placeholder={`Search posts in g/${slug}…`}
              label={`Search posts in this community`}
              className="max-w-xl"
            />
          </div>

          {/* Sort tabs */}
          <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl flex items-center gap-1 p-1.5 mb-4">
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
                <div key={i} className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl h-40 animate-pulse" />
              ))}
            </div>
          ) : postsError ? (
            <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl p-12 text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 mb-3 mx-auto">
                <AlertIcon className="h-8 w-8" />
              </div>
              <h3 className="font-bold text-[var(--color-text)] mb-1">Could not load posts</h3>
              <p className="text-sm text-[var(--color-muted)] mb-4">The server may be starting up. Please try again.</p>
              <button type="button" onClick={() => fetchPosts(0, sort, true, debouncedFeedSearch)}
                className="rounded-full bg-[var(--color-brand)] px-5 py-2 text-sm font-bold text-white hover:bg-[var(--color-brand-dark)] transition">
                Retry
              </button>
            </div>
          ) : posts.length === 0 ? (
            <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl p-12 text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[var(--color-brand)]/15 text-[var(--color-muted)] mb-3 mx-auto">
                <InboxIcon className="h-8 w-8" />
              </div>
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
                  onLike={handleLike}
                  onDelete={handleDelete}
                />
              ))}
              {hasMore && (
                <button type="button" onClick={() => fetchPosts(page + 1, sort, false)} disabled={loadingMore}
                  className="w-full py-3 rounded-2xl bg-[var(--color-card)] border border-[var(--color-border)] text-sm font-semibold text-[var(--color-brand)] hover:bg-[var(--color-hover)] transition disabled:opacity-50">
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
            <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl p-4">
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
                onClick={user ? handleJoinToggle : () => { toast("Please sign in to continue."); void signIn(undefined, { callbackUrl: typeof window !== "undefined" ? window.location.href : "/" }); }}
                disabled={joinLoading}
                className={`w-full rounded-full py-2 text-sm font-bold transition disabled:opacity-50 ${
                  group.joinedByMe
                    ? "border border-[var(--color-border)] text-[var(--color-text)] hover:bg-red-500/10 dark:hover:bg-red-950/40 hover:text-red-600 hover:border-red-400 dark:hover:border-red-800"
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
          <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl p-4">
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
            className="block text-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] py-3 text-sm font-semibold text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-hover)] transition">
            ← Back to all communities
          </Link>
        </aside>
      </main>

      {createOpen && session && (
        <CreatePostModal
          defaultGroupSlug={slug}
          onClose={() => setCreateOpen(false)}
          onCreated={post => setPosts(prev => [post as Post, ...prev])}
        />
      )}

      {searchOpen && (
        <SearchModal onClose={closeSearch} placeholder={`Search posts in g/${slug}…`} />
      )}
    </div>
  );
}
