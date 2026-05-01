"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import PostCard from "@/components/PostCard";
import { useSession } from "next-auth/react";
import { sessionToAuthUser } from "@/lib/auth";
import { authFetch } from "@/lib/authFetch";
import type { Post } from "@/lib/types";

export default function PostPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: session } = useSession();
  const user = session?.user ? sessionToAuthUser(session.user) : null;
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // UX-POST01: inline delete confirmation (replaces native confirm())
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const fetchPost = useCallback(async () => {
    setLoading(true);
    try {
      // authFetch ensures the token is refreshed so likedByMe is accurate
      const res = await authFetch(`/api/posts/${id}`);
      if (!res.ok) { setError("Post not found"); setLoading(false); return; }
      const data: Post = await res.json();
      setPost(data);
    } catch { setError("Failed to load post"); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { fetchPost(); }, [fetchPost]);

  async function handleLike(postId: string) {
    if (!session) { router.push("/login"); return; }
    const res = await authFetch(`/api/posts/${postId}/like`, { method: "POST" });
    if (!res.ok) return;
    const data: { liked: boolean; likesCount: number } = await res.json();
    setPost(prev => prev ? { ...prev, likedByMe: data.liked, likesCount: Math.max(0, data.likesCount) } : prev);
  }

  async function handleDelete(postId: string) {
    // UX-POST01: first call arms confirmation; second call confirms the delete
    if (!confirmingDelete) { setConfirmingDelete(true); return; }
    setConfirmingDelete(false);
    if (!session) return;
    const res = await authFetch(`/api/posts/${postId}`, { method: "DELETE" });
    if (res.ok || res.status === 204) {
      router.push("/");
    } else {
      setError("Failed to delete post. Please try again.");
    }
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      {/* UX-POST01 — inline delete confirmation (replaces browser confirm()) */}
      {confirmingDelete && post && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 rounded-2xl bg-white border border-red-200 shadow-xl px-5 py-3">
          <span className="text-sm font-medium text-gray-700">Delete this post?</span>
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
            className="text-sm font-medium text-gray-400 hover:text-gray-600 transition-colors"
          >
            Cancel
          </button>
        </div>
      )}
      <Navbar
        user={user}
        breadcrumb={{ label: "Community", href: "/" }}
      />

      <main className="mx-auto max-w-3xl px-4 py-6">
        {/* Back */}
        <button type="button" onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm text-[var(--color-muted)] hover:text-[var(--color-brand)] mb-4 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Back
        </button>

        {loading && (
          <div className="bg-white border border-[var(--color-border)] rounded-2xl h-64 animate-pulse" />
        )}

        {error && (
          <div className="bg-white border border-[var(--color-border)] rounded-2xl p-12 text-center">
            <div className="text-4xl mb-3">🌊</div>
            <h3 className="font-bold text-[var(--color-text)] mb-1">{error}</h3>
            <Link href="/" className="text-sm text-[var(--color-brand)] hover:underline">Go back to feed</Link>
          </div>
        )}

        {post && !loading && (
          <PostCard
            post={post}
            currentUserId={user?.id}
            onLike={handleLike}
            onDelete={handleDelete}
            compact={false}
          />
        )}
      </main>
    </div>
  );
}
