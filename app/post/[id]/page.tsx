"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import PostCard from "@/components/PostCard";
import { getToken, getUser, getInitials } from "@/lib/auth";
import type { Post } from "@/lib/types";
import type { AuthUser } from "@/lib/auth";

export default function PostPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // UX-POST01: inline delete confirmation (replaces native confirm())
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    setUser(getUser());
    setToken(getToken());
  }, []);

  const fetchPost = useCallback(async () => {
    setLoading(true);
    try {
      const headers: Record<string, string> = {};
      const t = getToken();
      if (t) headers["Authorization"] = `Bearer ${t}`;
      const res = await fetch(`/api/posts/${id}`, { headers });
      if (!res.ok) { setError("Post not found"); setLoading(false); return; }
      const data: Post = await res.json();
      setPost(data);
    } catch { setError("Failed to load post"); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { fetchPost(); }, [fetchPost]);

  async function handleLike(postId: string) {
    const t = token || getToken();
    if (!t) { router.push("/login"); return; }
    const res = await fetch(`/api/posts/${postId}/like`, {
      method: "POST",
      headers: { Authorization: `Bearer ${t}` },
    });
    if (res.ok) {
      const data: { liked: boolean; likesCount: number } = await res.json();
      setPost(prev => prev ? { ...prev, likedByMe: data.liked, likesCount: data.likesCount } : prev);
    }
  }

  async function handleDelete(postId: string) {
    // UX-POST01: first call arms confirmation; second call confirms the delete
    if (!confirmingDelete) { setConfirmingDelete(true); return; }
    setConfirmingDelete(false);
    const t = token || getToken();
    if (!t) return;
    const res = await fetch(`/api/posts/${postId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${t}` },
    });
    if (res.ok || res.status === 204) {
      router.push("/");
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
      {/* Navbar */}
      <header className="sticky top-0 z-40 bg-white border-b border-[var(--color-border)] shadow-sm">
        <div className="mx-auto max-w-3xl flex items-center gap-4 h-14 px-4">
          <Link href="/" className="flex items-center gap-2 font-bold text-[var(--color-text)]">
            <div className="h-8 w-8 rounded-full bg-[var(--color-brand)] flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" className="h-4 w-4">
                <path fillRule="evenodd" d="M11.54 22.351l.07.04.028.016a.76.76 0 00.723 0l.028-.015.071-.041a16.975 16.975 0 001.144-.742 19.58 19.58 0 002.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 00-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 002.682 2.282 16.975 16.975 0 001.145.742z" clipRule="evenodd" />
              </svg>
            </div>
            <span className="text-base">FloodWatch</span>
          </Link>
          <span className="text-[var(--color-muted)]">/</span>
          <span className="text-sm text-[var(--color-muted)] truncate">Community</span>
          {user && (
            <div className="ml-auto flex items-center gap-2">
              <div className="h-7 w-7 rounded-full bg-[var(--color-brand)] flex items-center justify-center text-[10px] font-bold text-white">
                {getInitials(user.displayName)}
              </div>
              <span className="text-sm font-semibold text-[var(--color-text)] hidden sm:block">{user.displayName}</span>
            </div>
          )}
        </div>
      </header>

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
            token={token ?? undefined}
            onLike={handleLike}
            onDelete={handleDelete}
            compact={false}
          />
        )}
      </main>
    </div>
  );
}
