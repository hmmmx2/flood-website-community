"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import ShareModal from "./ShareModal";
import type { Post } from "@/lib/types";
import { getInitials, timeAgo } from "@/lib/auth";
import { authFetch } from "@/lib/authFetch";

type Props = {
  post: Post;
  currentUserId?: string;
  token?: string;
  onLike: (postId: string) => void;
  onDelete?: (postId: string) => void;
  onEdit?: (postId: string, updated: Partial<Post>) => void;
  compact?: boolean;
};

export default function PostCard({ post, currentUserId, token, onLike, onDelete, onEdit, compact = true }: Props) {
  const [shareOpen, setShareOpen] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState(post.comments ?? []);
  const [showComments, setShowComments] = useState(!compact);
  const [submitting, setSubmitting] = useState(false);

  // Edit state
  const [editOpen, setEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState(post.title);
  const [editContent, setEditContent] = useState(post.content);
  const [editImagePreview, setEditImagePreview] = useState<string | null>(post.imageUrl ?? null);
  const [editImageBase64, setEditImageBase64] = useState<string | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function submitComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentText.trim() || !token) return;
    setSubmitting(true);
    try {
      const res = await authFetch(`/api/posts/${post.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: commentText.trim() }),
      });
      if (res.ok) {
        const c = await res.json();
        setComments(prev => [...prev, c]);
        setCommentText("");
      }
    } finally { setSubmitting(false); }
  }

  async function deleteComment(commentId: string) {
    if (!token) return;
    const res = await authFetch(`/api/posts/${post.id}/comments/${commentId}`, {
      method: "DELETE",
    });
    if (res.ok || res.status === 204) {
      setComments(prev => prev.filter(c => c.id !== commentId));
    }
  }

  function handleImageFile(file: File) {
    if (!file.type.startsWith("image/")) { setEditError("Please select an image file."); return; }
    if (file.size > 5 * 1024 * 1024) { setEditError("Image must be under 5 MB."); return; }
    const reader = new FileReader();
    reader.onload = e => {
      const result = e.target?.result as string;
      setEditImageBase64(result);
      setEditImagePreview(result);
      setRemoveImage(false);
      setEditError(null);
    };
    reader.readAsDataURL(file);
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editTitle.trim()) { setEditError("Title is required."); return; }
    setSaving(true); setEditError(null);
    try {
      const body: Record<string, unknown> = {
        title: editTitle.trim(),
        content: editContent.trim(),
        removeImage,
      };
      if (editImageBase64) body.imageUrl = editImageBase64;
      const res = await authFetch(`/api/posts/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        const msg = (res.status === 401 || res.status === 403)
          ? "Session expired. Please sign out and sign in again."
          : (d.error || "Failed to save.");
        setEditError(msg);
        setSaving(false);
        return;
      }
      const updated = await res.json();
      onEdit?.(post.id, { title: updated.title, content: updated.content, imageUrl: updated.imageUrl ?? null });
      setEditOpen(false);
    } catch { setEditError("Connection error."); }
    setSaving(false);
  }

  const isOwner = currentUserId && post.authorId === currentUserId;

  return (
    <>
      <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl overflow-hidden hover:border-[var(--color-muted)]/50 transition-colors">
        {/* Vote + content layout */}
        <div className="flex gap-0">
          {/* Left vote column */}
          <div className="flex flex-col items-center gap-0.5 bg-[var(--color-pill-bg)] px-2.5 py-3 rounded-l-2xl min-w-[44px]">
            <button
              type="button"
              onClick={() => onLike(post.id)}
              className={`flex flex-col items-center p-1 rounded-lg transition-all ${
                post.likedByMe
                  ? "text-[var(--color-brand)]"
                  : "text-[var(--color-muted)] hover:text-[var(--color-upvote)] hover:bg-orange-50"
              }`}
              title={post.likedByMe ? "Unlike" : "Like"}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                <path d="M7.493 18.75c-.425 0-.82-.236-.975-.632A7.48 7.48 0 016 15.375c0-1.75.599-3.358 1.602-4.634.151-.192.373-.309.6-.397.473-.183.89-.514 1.212-.924a9.042 9.042 0 012.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 00.322-1.672V3a.75.75 0 01.75-.75 2.25 2.25 0 012.25 2.25c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 01-2.649 7.521c-.388.482-.987.729-1.605.729H14.23c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 00-1.423-.23h-.777zM2.331 10.977a11.969 11.969 0 00-.831 4.398 12 12 0 00.52 3.507c.26.85 1.084 1.368 1.973 1.368H4.9c.445 0 .72-.498.523-.898a8.963 8.963 0 01-.924-3.977c0-1.708.476-3.305 1.302-4.666.245-.403-.028-.959-.5-.959H4.25c-.832 0-1.612.453-1.918 1.227z" />
              </svg>
              <span className={`text-xs font-bold leading-none ${post.likedByMe ? "text-[var(--color-brand)]" : "text-[var(--color-muted)]"}`}>
                {post.likesCount}
              </span>
            </button>
          </div>

          {/* Main content */}
          <div className="flex-1 p-3.5">
            {/* Group badge + author + time */}
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              {post.groupSlug && (
                <>
                  <Link href={`/g/${post.groupSlug}`}
                    className="text-xs font-bold text-[var(--color-brand)] hover:underline leading-none">
                    g/{post.groupSlug}
                  </Link>
                  <span className="text-[var(--color-muted)] text-xs">•</span>
                </>
              )}
              <div className="h-6 w-6 rounded-full bg-[var(--color-brand)] flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">
                {getInitials(post.authorName)}
              </div>
              <span className="text-xs font-semibold text-[var(--color-text)]">{post.authorName}</span>
              <span className="text-[var(--color-muted)] text-xs">•</span>
              <span className="text-[var(--color-muted)] text-xs">{timeAgo(post.createdAt)}</span>
            </div>

            {/* Title */}
            <Link href={`/post/${post.id}`}>
              <h2 className="font-semibold text-[var(--color-text)] text-[15px] leading-snug hover:text-[var(--color-brand)] transition-colors mb-2">
                {post.title}
              </h2>
            </Link>

            {/* Content (truncated in compact mode) */}
            <p className={`text-sm text-[var(--color-muted)] leading-relaxed mb-3 ${compact ? "line-clamp-3" : ""}`}>
              {post.content}
            </p>

            {/* Image */}
            {post.imageUrl && (
              <div className="mb-3 rounded-xl overflow-hidden bg-[var(--color-pill-bg)] max-h-[400px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={post.imageUrl} alt="Post image"
                  className="w-full object-cover max-h-[400px]"
                  onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
              </div>
            )}

            {/* Action bar */}
            <div className="flex items-center gap-1 flex-wrap">
              {/* Comments */}
              <button type="button" onClick={() => setShowComments(p => !p)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-[var(--color-muted)] hover:bg-[var(--color-pill-bg)] hover:text-[var(--color-text)] transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                </svg>
                {post.commentsCount} Comments
              </button>

              {/* Share */}
              <button type="button" onClick={() => setShareOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-[var(--color-muted)] hover:bg-[var(--color-pill-bg)] hover:text-[var(--color-text)] transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
                </svg>
                Share
              </button>

              {/* Edit + Delete (own post) */}
              {isOwner && (
                <div className="flex items-center gap-1 ml-auto">
                  <button type="button" onClick={() => { setEditOpen(true); setEditTitle(post.title); setEditContent(post.content); setEditImagePreview(post.imageUrl ?? null); setEditImageBase64(null); setRemoveImage(false); setEditError(null); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-[var(--color-muted)] hover:bg-[var(--color-pill-bg)] hover:text-[var(--color-brand)] transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                    </svg>
                    Edit
                  </button>
                  {onDelete && (
                    <button type="button" onClick={() => onDelete(post.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                      Delete
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Comments section */}
            {showComments && (
              <div className="mt-3 pt-3 border-t border-[var(--color-border)]">
                {/* Comment input */}
                {token ? (
                  <form onSubmit={submitComment} className="flex gap-2 mb-3">
                    <input
                      type="text"
                      value={commentText}
                      onChange={e => setCommentText(e.target.value)}
                      placeholder="Add a comment..."
                      className="flex-1 rounded-full border border-[var(--color-border)] bg-[var(--color-input-bg)] px-4 py-2 text-sm outline-none focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-brand)]/10"
                    />
                    <button type="submit" disabled={!commentText.trim() || submitting}
                      className="rounded-full bg-[var(--color-brand)] px-4 py-2 text-xs font-bold text-white transition hover:bg-[var(--color-brand-dark)] disabled:opacity-50">
                      Post
                    </button>
                  </form>
                ) : (
                  <p className="text-xs text-[var(--color-muted)] mb-3">
                    <Link href="/login" className="text-[var(--color-brand)] font-semibold hover:underline">Sign in</Link> to comment
                  </p>
                )}

                {/* Comment list */}
                <div className="space-y-2.5">
                  {comments.map(c => (
                    <div key={c.id} className="flex gap-2 group">
                      <div className="h-6 w-6 rounded-full bg-[var(--color-brand)]/20 flex items-center justify-center text-[10px] font-bold text-[var(--color-brand)] flex-shrink-0 mt-0.5">
                        {getInitials(c.authorName)}
                      </div>
                      <div className="flex-1 bg-[var(--color-pill-bg)] rounded-xl px-3 py-2">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-semibold text-[var(--color-text)]">{c.authorName}</span>
                          <span className="text-[10px] text-[var(--color-muted)]">{timeAgo(c.createdAt)}</span>
                          {(currentUserId === c.authorId) && (
                            <button type="button" onClick={() => deleteComment(c.id)}
                              className="ml-auto text-[10px] text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity">
                              Delete
                            </button>
                          )}
                        </div>
                        <p className="text-sm text-[var(--color-text)] leading-snug">{c.content}</p>
                      </div>
                    </div>
                  ))}
                  {comments.length === 0 && (
                    <p className="text-xs text-[var(--color-muted)] text-center py-2">No comments yet. Be the first!</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {shareOpen && <ShareModal postId={post.id} title={post.title} onClose={() => setShareOpen(false)} />}

      {/* Edit Modal */}
      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) setEditOpen(false); }}>
          <div className="bg-[var(--color-card)] rounded-2xl border border-[var(--color-border)] w-full max-w-lg shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
              <h3 className="font-semibold text-[var(--color-text)]">Edit Post</h3>
              <button type="button" onClick={() => setEditOpen(false)} className="text-[var(--color-muted)] hover:text-[var(--color-text)] p-1">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={saveEdit} className="p-5 space-y-4">
              {editError && <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">{editError}</div>}
              <div>
                <label className="block text-xs font-semibold text-[var(--color-muted)] mb-1.5 uppercase tracking-wide">Title</label>
                <input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)} required maxLength={500}
                  className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] px-4 py-2.5 text-sm outline-none focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-brand)]/10" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--color-muted)] mb-1.5 uppercase tracking-wide">Content</label>
                <textarea value={editContent} onChange={e => setEditContent(e.target.value)} rows={4}
                  className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] px-4 py-2.5 text-sm outline-none focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-brand)]/10 resize-none" />
              </div>

              {/* Image section */}
              <div>
                <label className="block text-xs font-semibold text-[var(--color-muted)] mb-1.5 uppercase tracking-wide">Image</label>
                {editImagePreview && !removeImage ? (
                  <div className="relative rounded-xl overflow-hidden bg-[var(--color-pill-bg)] mb-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={editImagePreview} alt="Preview" className="w-full max-h-48 object-cover" />
                    <div className="absolute top-2 right-2 flex gap-2">
                      <button type="button" onClick={() => fileInputRef.current?.click()}
                        className="bg-black/60 text-white text-xs px-2 py-1 rounded-lg hover:bg-black/80">Change</button>
                      <button type="button" onClick={() => { setEditImagePreview(null); setEditImageBase64(null); setRemoveImage(true); }}
                        className="bg-red-500/80 text-white text-xs px-2 py-1 rounded-lg hover:bg-red-600">Remove</button>
                    </div>
                  </div>
                ) : (
                  <button type="button" onClick={() => fileInputRef.current?.click()}
                    className="w-full border-2 border-dashed border-[var(--color-border)] rounded-xl py-6 text-sm text-[var(--color-muted)] hover:border-[var(--color-brand)] hover:text-[var(--color-brand)] transition-colors flex flex-col items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-8 w-8">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                    </svg>
                    <span>Click to upload an image <span className="text-[10px] block opacity-60">PNG, JPG, GIF · max 5 MB</span></span>
                  </button>
                )}
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                  onChange={e => { if (e.target.files?.[0]) handleImageFile(e.target.files[0]); }} />
              </div>

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setEditOpen(false)}
                  className="flex-1 rounded-xl border border-[var(--color-border)] py-2.5 text-sm font-semibold text-[var(--color-muted)] hover:bg-[var(--color-pill-bg)] transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={saving || !editTitle.trim()}
                  className="flex-1 rounded-xl bg-[var(--color-brand)] py-2.5 text-sm font-bold text-white transition hover:bg-[var(--color-brand-dark)] disabled:opacity-50">
                  {saving ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
