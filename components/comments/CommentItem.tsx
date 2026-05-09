"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import { authFetchJson } from "@/lib/fetchJson";
import type { Comment, CommentNode } from "@/lib/types";
import { getInitials, timeAgo } from "@/lib/auth";
import CommentForm from "./CommentForm";
import CommentVoteButtons from "./CommentVoteButtons";
import CommentThread from "./CommentThread";

const MAX_DEPTH = 6;

type Props = {
  postId: string;
  node: CommentNode;
  currentUserId?: string;
  depth: number;
  onPatch: (c: CommentNode) => void;
  onAdd: (c: Comment) => void;
  onCommentMutated?: () => void;
};

export default function CommentItem({
  postId,
  node: n,
  currentUserId,
  depth,
  onPatch,
  onAdd,
  onCommentMutated,
}: Props) {
  const [replyOpen, setReplyOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(n.content);
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Kebab menu — portal-rendered to escape parent overflow, mirrors the
  // post kebab in PostCard so the UX matches across the post and its
  // comments. Coordinates are recalculated on scroll/resize.
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const kebabRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const canModify =
    !n.deleted && !!currentUserId && !!n.authorId && currentUserId === n.authorId;

  useEffect(() => {
    if (!menuOpen) return;
    const recalc = () => {
      const b = kebabRef.current;
      if (!b) return;
      const r = b.getBoundingClientRect();
      const menuW = 160;
      const left = Math.min(window.innerWidth - menuW - 8, r.right - menuW);
      setMenuPos({ top: r.bottom + 4, left: Math.max(8, left) });
    };
    recalc();
    window.addEventListener("scroll", recalc, true);
    window.addEventListener("resize", recalc);
    return () => {
      window.removeEventListener("scroll", recalc, true);
      window.removeEventListener("resize", recalc);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node | null;
      if (!t) return;
      if (kebabRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    const t = editText.trim();
    if (!t || t === n.content) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      const updated = await authFetchJson<Comment>(`/api/posts/${postId}/comments/${n.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: t }),
      });
      onPatch({ ...n, ...updated, children: n.children });
      setEditing(false);
      onCommentMutated?.();
      toast.success("Updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save edit.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setDeleting(true);
    try {
      await authFetchJson(`/api/posts/${postId}/comments/${n.id}`, { method: "DELETE" });
      onPatch({
        ...n,
        deleted: true,
        content: "[deleted]",
        authorName: "[deleted]",
        authorId: "",
        children: n.children,
      });
      onCommentMutated?.();
      toast.success("Removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't delete.");
    } finally {
      setDeleting(false);
      setConfirmingDelete(false);
    }
  }

  const continueHref = `/post/${postId}/comment/${n.id}`;
  const showContinue = depth >= MAX_DEPTH && n.children.length > 0;

  return (
    <div id={`comment-${n.id}`} className="group flex gap-3 scroll-mt-24">
      {/* Avatar (Twitter/Facebook-style outside the bubble) */}
      <div
        aria-hidden
        className="mt-0.5 h-9 w-9 flex-shrink-0 rounded-full bg-[var(--color-brand)]/15 flex items-center justify-center text-[11px] font-bold text-[var(--color-brand)] select-none"
      >
        {getInitials(n.authorName)}
      </div>

      <div className="flex-1 min-w-0">
        {/* Bubble: name/time on first line, body below, kebab anchored top-right */}
        <div className="relative rounded-2xl bg-[var(--color-pill-bg)] px-3.5 py-2.5">
          <div className="flex items-center gap-1.5 flex-wrap pr-7">
            <span className="text-sm font-bold text-[var(--color-text)]">
              {n.authorName}
            </span>
            <span className="text-[var(--color-muted)] text-xs">·</span>
            <span className="text-xs text-[var(--color-muted)]" title={n.createdAt}>
              {timeAgo(n.createdAt)}
            </span>
            {n.updatedAt && !n.deleted && (
              <span className="text-[10px] text-[var(--color-muted)]">(edited)</span>
            )}
          </div>

          {canModify && !editing && (
            <button
              ref={kebabRef}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen((v) => !v);
              }}
              aria-label="Comment actions"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              className="absolute top-1.5 right-1.5 flex h-7 w-7 items-center justify-center rounded-full text-[var(--color-muted)] hover:bg-[var(--color-card)] hover:text-[var(--color-text)] transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="h-4 w-4"
              >
                <circle cx="12" cy="5" r="1.6" />
                <circle cx="12" cy="12" r="1.6" />
                <circle cx="12" cy="19" r="1.6" />
              </svg>
            </button>
          )}

          {editing ? (
            <form onSubmit={saveEdit} className="mt-2 space-y-2">
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setEditing(false);
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    void saveEdit(e as unknown as React.FormEvent);
                  }
                }}
                rows={3}
                autoFocus
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-brand)]/15 resize-y min-h-[72px]"
              />
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setEditing(false);
                    setEditText(n.content);
                  }}
                  className="rounded-full px-3 py-1 text-xs font-semibold text-[var(--color-muted)] hover:bg-[var(--color-card)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !editText.trim() || editText.trim() === n.content}
                  className="rounded-full bg-[var(--color-brand)] px-3 py-1 text-xs font-bold text-white hover:bg-[var(--color-brand-dark)] disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          ) : (
            <p className="mt-1 text-sm text-[var(--color-text)] whitespace-pre-wrap break-words">
              {n.content}
            </p>
          )}
        </div>

        {/* Action row — vote / reply (Facebook/Twitter style: text only, light) */}
        {!editing && (
          <div className="mt-1 flex items-center gap-1 pl-1.5 text-[11px] font-semibold text-[var(--color-muted)]">
            <CommentVoteButtons
              postId={postId}
              commentId={n.id}
              score={n.score}
              myVote={n.myVote}
              disabled={n.deleted}
              variant="inline"
              onVoteResult={(score, myVote) => {
                onPatch({ ...n, score, myVote, children: n.children });
              }}
            />
            {!n.deleted && currentUserId && (
              <button
                type="button"
                className="ml-1 rounded-full px-2 py-0.5 hover:bg-[var(--color-pill-bg)] hover:text-[var(--color-text)] transition-colors"
                onClick={() => setReplyOpen((v) => !v)}
              >
                Reply
              </button>
            )}
            {confirmingDelete && (
              <span className="ml-2 inline-flex items-center gap-2 rounded-full bg-red-500/10 px-2 py-0.5 text-red-500">
                Delete this comment?
                <button
                  type="button"
                  onClick={() => void remove()}
                  disabled={deleting}
                  className="font-bold hover:opacity-80 disabled:opacity-50"
                >
                  {deleting ? "Deleting…" : "Delete"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  className="text-[var(--color-muted)] hover:text-[var(--color-text)]"
                >
                  Cancel
                </button>
              </span>
            )}
          </div>
        )}

        {replyOpen && (
          <div className="mt-2">
            <CommentForm
              postId={postId}
              parentId={n.id}
              placeholder={`Reply to ${n.authorName}…`}
              onCreated={(c) => {
                onAdd(c);
                setReplyOpen(false);
              }}
              onCancel={() => setReplyOpen(false)}
              autoFocus
            />
          </div>
        )}

        {showContinue && (
          <Link
            href={continueHref}
            className="inline-block mt-2 text-xs font-semibold text-[var(--color-brand)] hover:underline"
          >
            Continue this thread →
          </Link>
        )}

        {!showContinue && n.children.length > 0 && (
          <div className="mt-3 ml-3 border-l border-[var(--color-border)] pl-4 space-y-3">
            <CommentThread
              postId={postId}
              nodes={n.children}
              currentUserId={currentUserId}
              depth={depth + 1}
              onPatch={onPatch}
              onAdd={onAdd}
              onCommentMutated={onCommentMutated}
            />
          </div>
        )}
      </div>

      {/* Portal'd kebab menu — escapes the comment's overflow corners */}
      {menuOpen && menuPos && typeof document !== "undefined" &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "fixed",
              top: menuPos.top,
              left: menuPos.left,
              width: 160,
            }}
            className="z-[80] overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-xl ring-1 ring-black/5"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                setEditing(true);
                setEditText(n.content);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[var(--color-text)] hover:bg-[var(--color-pill-bg)] transition-colors"
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
                aria-hidden
              >
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              Edit
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                setConfirmingDelete(true);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-500/10 transition-colors"
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
                aria-hidden
              >
                <path d="M3 6h18" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
              Delete
            </button>
          </div>,
          document.body,
        )}
    </div>
  );
}
