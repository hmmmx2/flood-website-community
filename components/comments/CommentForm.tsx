"use client";

import { useState } from "react";
import { authFetchJson } from "@/lib/fetchJson";
import type { Comment } from "@/lib/types";
import toast from "react-hot-toast";

// Mirrors the backend cap on `CreateCommunityCommentRequest.content`.
const COMMENT_MAX = 1500;

type Props = {
  postId: string;
  parentId: string | null;
  placeholder?: string;
  onCreated: (c: Comment) => void;
  onCancel?: () => void;
  autoFocus?: boolean;
};

export default function CommentForm({
  postId,
  parentId,
  placeholder = "What are your thoughts?",
  onCreated,
  onCancel,
  autoFocus,
}: Props) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    setSaving(true);
    try {
      const body: { content: string; parentId?: string } = { content: t };
      if (parentId) body.parentId = parentId;
      const c = await authFetchJson<Comment>(`/api/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      onCreated(c);
      setText("");
      onCancel?.();
      toast.success(parentId ? "Reply posted" : "Comment posted");
    } catch (err) {
      // Keyed toast so successive failures replace rather than stack —
      // matches the toast-dedup policy on the Like button. 429s from the
      // rate limiter share the dedicated "rate-limit" key (see fetchJson).
      const msg = err instanceof Error ? err.message : "Failed to post";
      toast.error(msg, { id: "comment-post-error" });
    } finally {
      setSaving(false);
    }
  }

  const tone =
    text.length >= COMMENT_MAX ? "text-red-500" :
    text.length >= COMMENT_MAX * 0.9 ? "text-amber-500" :
    "text-[var(--color-muted)]";

  return (
    <form onSubmit={submit} className="space-y-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        rows={parentId ? 3 : 4}
        maxLength={COMMENT_MAX}
        className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-brand)]/15 resize-y min-h-[80px]"
      />
      <div className="flex items-center justify-between">
        <p className={`text-[11px] tabular-nums ${tone}`}>{text.length} / {COMMENT_MAX}</p>
        <div className="flex gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full px-4 py-1.5 text-xs font-semibold text-[var(--color-muted)] hover:bg-[var(--color-pill-bg)]"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={!text.trim() || saving || text.length > COMMENT_MAX}
          className="rounded-full bg-[var(--color-brand)] px-4 py-1.5 text-xs font-bold text-white hover:bg-[var(--color-brand-dark)] disabled:opacity-50"
        >
          {saving ? "Posting…" : parentId ? "Reply" : "Comment"}
        </button>
        </div>
      </div>
    </form>
  );
}
