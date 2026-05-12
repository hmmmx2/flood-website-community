"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import SearchModal from "@/components/SearchModal";
import PostCard from "@/components/PostCard";
import CommentSection from "@/components/comments/CommentSection";
import { useSession, signIn } from "next-auth/react";
import toast from "react-hot-toast";
import { sessionToAuthUser } from "@/lib/auth";
import { authFetchJson } from "@/lib/fetchJson";
import { showErrorToast } from "@/lib/errorToast";
import type { Post } from "@/lib/types";
import { WaveIcon } from "@/components/icons";
import { useSiteSearchModal } from "@/lib/useSiteSearchModal";
import { PAGE_CONTAINER, READABLE_CONTAINER } from "@/lib/layout";

export default function PostPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: session } = useSession();
  const user = session?.user ? sessionToAuthUser(session.user) : null;
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** Matches GET /comments totalComments so the card badge is not stale vs the list. */
  const [commentsCountOverride, setCommentsCountOverride] = useState<number | undefined>(undefined);
  const { searchOpen, openSearch, closeSearch } = useSiteSearchModal();
  // UX-POST01: inline delete confirmation (replaces native confirm())
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const fetchPost = useCallback(async () => {
    setLoading(true);
    try {
      const data = await authFetchJson<Post>(`/api/posts/${id}`);
      setPost(data);
    } catch {
      setError("Post not found");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchPost(); }, [fetchPost]);

  useEffect(() => {
    setCommentsCountOverride(undefined);
  }, [id]);

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
      setPost((prev) =>
        prev ? { ...prev, likedByMe: data.liked, likesCount: Math.max(0, data.likesCount) } : prev,
      );
    } catch (e) {
      showErrorToast(e, "like-error", "Failed to update like.");
    }
  }

  async function handleDelete(postId: string) {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    setConfirmingDelete(false);
    if (!session) return;
    try {
      await authFetchJson(`/api/posts/${postId}`, { method: "DELETE" });
      toast.success("Post deleted");
      router.push("/");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete post.");
    }
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      {/* UX-POST01 — inline delete confirmation (replaces browser confirm()) */}
      {confirmingDelete && post && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 rounded-2xl bg-[var(--color-card)] border border-red-200 dark:border-red-900/50 shadow-xl px-5 py-3">
          <span className="text-sm font-medium text-[var(--color-text)]">Delete this post?</span>
          <button
            type="button"
            onClick={() => handleDelete(post.id)}
            className="text-sm font-bold text-red-600 hover:text-red-700 transition-colors"
          >
            Delete
          </button>
          <button
            type="button"
            onClick={() => setConfirmingDelete(false)}
            className="text-sm font-medium text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors"
          >
            Cancel
          </button>
        </div>
      )}
      <Navbar
        user={user}
        onSearchOpen={openSearch}
        searchPlaceholder="Search posts & communities…"
        breadcrumb={{ label: "Community", href: "/" }}
      />

      <main className={`${PAGE_CONTAINER} py-6`}>
        <div className={READABLE_CONTAINER}>
        {/* Back */}
        <button type="button" onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm text-[var(--color-muted)] hover:text-[var(--color-brand)] mb-4 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Back
        </button>

        {loading && (
          <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl h-64 animate-pulse" />
        )}

        {error && (
          <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl p-12 text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[var(--color-brand)]/15 text-[var(--color-brand)] mb-3 mx-auto">
              <WaveIcon className="h-8 w-8" />
            </div>
            <h3 className="font-bold text-[var(--color-text)] mb-1">{error}</h3>
            <Link href="/" className="text-sm text-[var(--color-brand)] hover:underline">Go back to feed</Link>
          </div>
        )}

        {post && !loading && (
          <>
            <PostCard
              post={post}
              currentUserId={user?.id}
              onLike={handleLike}
              onDelete={handleDelete}
              compact={false}
              commentsCountOverride={commentsCountOverride}
            />
            <div className="mt-8">
              <CommentSection
                postId={post.id}
                currentUserId={user?.id}
                onTotalCommentsChange={setCommentsCountOverride}
              />
            </div>
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
