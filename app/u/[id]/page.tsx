"use client";

/**
 * /u/[id] — public user profile, Reddit + Facebook + X hybrid.
 *
 * Shows a hero with avatar / display name / member-since / post + comment
 * counts, then a paginated list of the user's community posts using the
 * same PostCard the feed uses. The viewer's own profile gets an inline
 * "Edit avatar" affordance that PATCHes /api/auth/profile.
 */

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { useSession, signIn } from "next-auth/react";
import Navbar from "@/components/Navbar";
import PostCard from "@/components/PostCard";
import SearchModal from "@/components/SearchModal";
import AvatarUploader from "@/components/AvatarUploader";
import { authFetchJson } from "@/lib/fetchJson";
import { showErrorToast } from "@/lib/errorToast";
import { sessionToAuthUser, getInitials } from "@/lib/auth";
import { useSiteSearchModal } from "@/lib/useSiteSearchModal";
import { PAGE_CONTAINER, READABLE_CONTAINER } from "@/lib/layout";
import type { Post } from "@/lib/types";

type PublicUserProfile = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  role: string;
  createdAt: string | null;
  postCount: number;
  commentCount: number;
};

type PostPage = {
  content: Post[];
  last: boolean;
  number: number;
  totalElements?: number;
};

function joinedLabel(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-MY", { month: "long", year: "numeric" });
}

export default function UserProfilePage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const viewer = session?.user ? sessionToAuthUser(session.user) : null;
  const isOwn = viewer?.id === id;

  const { searchOpen, openSearch, closeSearch } = useSiteSearchModal();

  const [profile, setProfile] = useState<PublicUserProfile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [posts, setPosts] = useState<Post[]>([]);
  const [postsPage, setPostsPage] = useState(0);
  const [postsHasMore, setPostsHasMore] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(true);

  const [editingAvatar, setEditingAvatar] = useState(false);

  const fetchProfile = useCallback(async () => {
    try {
      const data = await authFetchJson<PublicUserProfile>(`/api/users/${id}`);
      setProfile(data);
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : "User not found");
    }
  }, [id]);

  const fetchPosts = useCallback(
    async (page: number, replace: boolean) => {
      setLoadingPosts(true);
      try {
        const data = await authFetchJson<PostPage>(`/api/users/${id}/posts?page=${page}&size=20`);
        setPosts((prev) => (replace ? data.content : [...prev, ...data.content]));
        setPostsHasMore(!data.last);
        setPostsPage(page);
      } catch {
        // PostCard list is empty in this case; the user can refresh.
      } finally {
        setLoadingPosts(false);
      }
    },
    [id],
  );

  useEffect(() => {
    void fetchProfile();
    void fetchPosts(0, true);
  }, [fetchProfile, fetchPosts]);

  async function handleLike(postId: string) {
    if (!session) {
      toast("Please sign in to continue.");
      void signIn(undefined, {
        callbackUrl: typeof window !== "undefined" ? window.location.href : "/",
      });
      return;
    }
    try {
      const data = await authFetchJson<{ liked: boolean; likesCount: number }>(
        `/api/posts/${postId}/like`,
        { method: "POST" },
      );
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, likedByMe: data.liked, likesCount: Math.max(0, data.likesCount) }
            : p,
        ),
      );
    } catch (e) {
      showErrorToast(e, "like-error", "Failed to update like.");
    }
  }

  async function handleDelete(postId: string) {
    if (!confirm("Delete this post? This cannot be undone.")) return;
    try {
      await authFetchJson(`/api/posts/${postId}`, { method: "DELETE" });
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      setProfile((p) => (p ? { ...p, postCount: Math.max(0, p.postCount - 1) } : p));
      toast.success("Post deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete post.");
    }
  }

  async function persistAvatar(value: string | null) {
    if (!isOwn) return;
    try {
      await authFetchJson("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarUrl: value }),
      });
      setProfile((p) => (p ? { ...p, avatarUrl: value } : p));
      setEditingAvatar(false);
      toast.success(value ? "Profile picture updated" : "Profile picture removed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't update avatar.");
    }
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <Navbar
        user={viewer}
        onSearchOpen={openSearch}
        searchPlaceholder="Search posts & communities…"
        breadcrumb={{ label: "Community", href: "/" }}
      />

      <main className={`${PAGE_CONTAINER} py-6`}>
        <div className={READABLE_CONTAINER}>
        <button
          type="button"
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm text-[var(--color-muted)] hover:text-[var(--color-brand)] mb-4 transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="h-4 w-4"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
            />
          </svg>
          Back
        </button>

        {profileError && (
          <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl p-12 text-center">
            <h3 className="font-bold text-[var(--color-text)] mb-1">{profileError}</h3>
            <Link href="/" className="text-sm text-[var(--color-brand)] hover:underline">
              Go back to feed
            </Link>
          </div>
        )}

        {!profileError && profile && (
          <>
            {/* Hero — Reddit-flavoured banner with Facebook-style avatar overlap */}
            <section className="relative overflow-hidden rounded-3xl border border-[var(--color-border)] bg-[var(--color-card)] mb-6">
              <div
                aria-hidden
                className="h-32 sm:h-40 w-full"
                style={{
                  background:
                    "linear-gradient(135deg, var(--color-brand) 0%, color-mix(in srgb, var(--color-brand) 60%, #0f172a) 100%)",
                }}
              />
              <div className="px-5 sm:px-7 pb-6">
                <div className="-mt-12 sm:-mt-14 flex flex-col sm:flex-row sm:items-end gap-4">
                  {/* Avatar */}
                  <div className="relative">
                    <div className="h-24 w-24 sm:h-28 sm:w-28 rounded-full ring-4 ring-[var(--color-card)] bg-[var(--color-brand)]/15 flex items-center justify-center text-2xl font-bold text-[var(--color-brand)] overflow-hidden">
                      {profile.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={profile.avatarUrl}
                          alt={profile.displayName}
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                          }}
                        />
                      ) : (
                        getInitials(profile.displayName)
                      )}
                    </div>
                    {isOwn && !editingAvatar && (
                      <button
                        type="button"
                        onClick={() => setEditingAvatar(true)}
                        aria-label="Change profile picture"
                        className="absolute bottom-1 right-1 flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-card)] border border-[var(--color-border)] shadow-md text-[var(--color-text)] hover:bg-[var(--color-pill-bg)] transition"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="h-4 w-4"
                        >
                          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                          <circle cx="12" cy="13" r="4" />
                        </svg>
                      </button>
                    )}
                  </div>

                  {/* Identity */}
                  <div className="flex-1 min-w-0">
                    <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text)] tracking-tight">
                      {profile.displayName}
                    </h1>
                    <p className="text-xs text-[var(--color-muted)] mt-0.5">
                      {profile.role === "admin" || profile.role === "operations_manager"
                        ? "FloodWatch staff"
                        : "Community member"}
                      {profile.createdAt && ` · joined ${joinedLabel(profile.createdAt)}`}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
                      <span className="text-[var(--color-text)]">
                        <span className="font-bold tabular-nums">{profile.postCount}</span>
                        <span className="ml-1 text-[var(--color-muted)]">posts</span>
                      </span>
                      <span className="text-[var(--color-text)]">
                        <span className="font-bold tabular-nums">{profile.commentCount}</span>
                        <span className="ml-1 text-[var(--color-muted)]">comments</span>
                      </span>
                    </div>
                  </div>

                  {isOwn && (
                    <div className="sm:ml-auto">
                      <Link
                        href="/settings"
                        className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] px-4 py-2 text-xs font-bold text-[var(--color-text)] hover:bg-[var(--color-pill-bg)] transition"
                      >
                        Edit profile
                      </Link>
                    </div>
                  )}
                </div>

                {/* Inline avatar uploader — file picker, no URLs */}
                {isOwn && editingAvatar && (
                  <div className="mt-5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-pill-bg)] p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-xs font-bold text-[var(--color-text)]">
                        Profile picture
                      </p>
                      <button
                        type="button"
                        onClick={() => setEditingAvatar(false)}
                        className="text-[11px] font-semibold text-[var(--color-muted)] hover:text-[var(--color-text)]"
                      >
                        Done
                      </button>
                    </div>
                    <AvatarUploader
                      value={profile.avatarUrl}
                      fallbackName={profile.displayName}
                      onChange={(dataUrl) => persistAvatar(dataUrl)}
                      onClear={() => persistAvatar(null)}
                    />
                  </div>
                )}
              </div>
            </section>

            {/* Posts list */}
            <section>
              <h2 className="text-lg font-bold text-[var(--color-text)] mb-3">
                {isOwn ? "Your posts" : `Posts by ${profile.displayName}`}
              </h2>

              {loadingPosts && posts.length === 0 && (
                <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl h-40 animate-pulse" />
              )}

              {!loadingPosts && posts.length === 0 && (
                <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl p-10 text-center">
                  <p className="text-sm font-semibold text-[var(--color-text)]">
                    {isOwn ? "You haven't posted yet" : "No posts yet"}
                  </p>
                  <p className="mt-1 text-xs text-[var(--color-muted)]">
                    {isOwn
                      ? "Share something with the community to see it here."
                      : "When this user posts, it'll show up here."}
                  </p>
                  {isOwn && (
                    <Link
                      href="/?compose=1"
                      className="mt-4 inline-flex rounded-full bg-[var(--color-brand)] px-4 py-2 text-xs font-bold text-white hover:bg-[var(--color-brand-dark)]"
                    >
                      Create your first post
                    </Link>
                  )}
                </div>
              )}

              <div className="space-y-3">
                {posts.map((p) => (
                  <PostCard
                    key={p.id}
                    post={p}
                    currentUserId={viewer?.id}
                    onLike={handleLike}
                    onDelete={handleDelete}
                    compact={true}
                  />
                ))}
              </div>

              {postsHasMore && (
                <button
                  type="button"
                  onClick={() => void fetchPosts(postsPage + 1, false)}
                  disabled={loadingPosts}
                  className="mt-4 w-full rounded-xl border border-[var(--color-border)] py-2 text-sm font-semibold text-[var(--color-brand)] hover:bg-[var(--color-pill-bg)] disabled:opacity-50"
                >
                  {loadingPosts ? "Loading…" : "Load more"}
                </button>
              )}
            </section>
          </>
        )}
        </div>
      </main>

      {searchOpen && (
        <SearchModal onClose={closeSearch} placeholder="Search posts & communities…" />
      )}
    </div>
  );
}
