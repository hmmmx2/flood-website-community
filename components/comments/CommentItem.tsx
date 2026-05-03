"use client";

import { useState } from "react";
import Link from "next/link";
import { authFetchJson } from "@/lib/fetchJson";
import type { Comment, CommentNode } from "@/lib/types";
import { getInitials, timeAgo } from "@/lib/auth";
import CommentForm from "./CommentForm";
import CommentVoteButtons from "./CommentVoteButtons";
import CommentThread from "./CommentThread";
import toast from "react-hot-toast";

const MAX_DEPTH = 6;

type Props = {
  postId: string;
  node: CommentNode;
  currentUserId?: string;
  depth: number;
  onPatch: (c: CommentNode) => void;
  onAdd: (c: Comment) => void;
};

export default function CommentItem({ postId, node: n, currentUserId, depth, onPatch, onAdd }: Props) {
  const [replyOpen, setReplyOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(n.content);

  const canModify =
    !n.deleted && currentUserId && n.authorId && currentUserId === n.authorId;

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    const t = editText.trim();
    if (!t) return;
    try {
      const updated = await authFetchJson<Comment>(`/api/posts/${postId}/comments/${n.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: t }),
      });
      onPatch({ ...n, ...updated, children: n.children });
      setEditing(false);
      toast.success("Updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  async function remove() {
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
      toast.success("Removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  const continueHref = `/post/${postId}/comment/${n.id}`;
  const showContinue = depth >= MAX_DEPTH && n.children.length > 0;

  return (
    <div id={`comment-${n.id}`} className="flex gap-2 scroll-mt-24">
      <CommentVoteButtons
        postId={postId}
        commentId={n.id}
        score={n.score}
        myVote={n.myVote}
        disabled={n.deleted}
        onVoteResult={(score, myVote) => {
          onPatch({ ...n, score, myVote, children: n.children });
        }}
      />
      <div className="flex-1 min-w-0">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <div className="h-6 w-6 rounded-full bg-[var(--color-brand)]/20 flex items-center justify-center text-[10px] font-bold text-[var(--color-brand)]">
              {getInitials(n.authorName)}
            </div>
            <span className="text-xs font-semibold text-[var(--color-text)]">{n.authorName}</span>
            <span className="text-[10px] text-[var(--color-muted)]">{timeAgo(n.createdAt)}</span>
            {n.updatedAt && !n.deleted && (
              <span className="text-[10px] text-[var(--color-muted)]">(edited)</span>
            )}
            {canModify && !editing && (
              <span className="ml-auto flex gap-2">
                <button
                  type="button"
                  className="text-[10px] font-semibold text-[var(--color-brand)]"
                  onClick={() => {
                    setEditing(true);
                    setEditText(n.content);
                  }}
                >
                  Edit
                </button>
                <button type="button" className="text-[10px] font-semibold text-red-500" onClick={() => void remove()}>
                  Delete
                </button>
              </span>
            )}
          </div>
          {editing ? (
            <form onSubmit={saveEdit} className="space-y-2 pt-1">
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-input-bg)] px-2 py-1 text-sm"
              />
              <div className="flex gap-2 justify-end">
                <button type="button" className="text-xs text-[var(--color-muted)]" onClick={() => setEditing(false)}>
                  Cancel
                </button>
                <button type="submit" className="text-xs font-bold text-[var(--color-brand)]">
                  Save
                </button>
              </div>
            </form>
          ) : (
            <p className="text-sm text-[var(--color-text)] whitespace-pre-wrap break-words">{n.content}</p>
          )}
          {!n.deleted && currentUserId && (
            <button
              type="button"
              className="mt-2 text-xs font-semibold text-[var(--color-muted)] hover:text-[var(--color-brand)]"
              onClick={() => setReplyOpen((v) => !v)}
            >
              Reply
            </button>
          )}
        </div>

        {replyOpen && (
          <div className="mt-2 pl-1">
            <CommentForm
              postId={postId}
              parentId={n.id}
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
          <Link href={continueHref} className="inline-block mt-2 text-xs font-semibold text-[var(--color-brand)] hover:underline">
            Continue this thread →
          </Link>
        )}

        {!showContinue && n.children.length > 0 && (
          <div className="mt-2 ml-2 border-l border-[var(--color-border)] pl-3 space-y-3">
            <CommentThread
              postId={postId}
              nodes={n.children}
              currentUserId={currentUserId}
              depth={depth + 1}
              onPatch={onPatch}
              onAdd={onAdd}
            />
          </div>
        )}
      </div>
    </div>
  );
}
