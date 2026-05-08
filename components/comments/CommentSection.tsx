"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { authFetchJson } from "@/lib/fetchJson";
import type { Comment, CommentSort, CommentsPage } from "@/lib/types";
import { buildCommentTree } from "@/lib/comments";
import CommentForm from "./CommentForm";
import CommentThread from "./CommentThread";

function normalizeComment(raw: unknown): Comment {
  const r = raw as Record<string, unknown>;
  const mv = Number(r.myVote ?? 0);
  return {
    id: String(r.id),
    parentId: r.parentId ? String(r.parentId) : null,
    authorId: String(r.authorId ?? ""),
    authorName: String(r.authorName ?? ""),
    authorAvatar: r.authorAvatar ? String(r.authorAvatar) : undefined,
    content: String(r.content ?? ""),
    score: Number(r.score ?? 0),
    myVote: (mv === -1 || mv === 1 ? mv : 0) as -1 | 0 | 1,
    createdAt: String(r.createdAt ?? ""),
    updatedAt: r.updatedAt ? String(r.updatedAt) : undefined,
    deleted: Boolean(r.deleted),
    replyCount: Number(r.replyCount ?? 0),
  };
}

type Props = {
  postId: string;
  currentUserId?: string;
  /** Fired when we learn total comment rows from the comments API (load / refresh). */
  onTotalCommentsChange?: (totalComments: number) => void;
};

export default function CommentSection({ postId, currentUserId, onTotalCommentsChange }: Props) {
  const [sort, setSort] = useState<CommentSort>("new");
  const [page, setPage] = useState(0);
  const [flat, setFlat] = useState<Comment[]>([]);
  const [totalTop, setTotalTop] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const tree = useMemo(() => buildCommentTree(flat), [flat]);

  const publishTotal = useCallback(
    (n: number) => {
      onTotalCommentsChange?.(n);
    },
    [onTotalCommentsChange],
  );

  const refreshCommentTotal = useCallback(async () => {
    const qs = new URLSearchParams({ sort, page: "0", size: "1" });
    try {
      const data = await authFetchJson<CommentsPage>(`/api/posts/${postId}/comments?${qs}`);
      if (typeof data.totalComments === "number") {
        publishTotal(data.totalComments);
      }
    } catch {
      /* ignore — badge keeps last known value */
    }
  }, [postId, sort, publishTotal]);

  const fetchPage = useCallback(
    async (p: number, append: boolean) => {
      const qs = new URLSearchParams({ sort, page: String(p), size: "20" });
      const data = await authFetchJson<CommentsPage>(`/api/posts/${postId}/comments?${qs}`);
      const norm = data.comments.map(normalizeComment);
      if (typeof data.totalComments === "number") {
        publishTotal(data.totalComments);
      }
      setFlat((prev) => {
        if (!append) return norm;
        const seen = new Set(prev.map((x) => x.id));
        const out = [...prev];
        for (const c of norm) {
          if (!seen.has(c.id)) {
            seen.add(c.id);
            out.push(c);
          }
        }
        return out;
      });
      setTotalTop(data.totalTopLevel);
    },
    [postId, publishTotal, sort],
  );

  // Re-fetch every page currently shown so server truth wins after a
  // mutation (delete reshapes the tree, edit updates content). Without
  // this the optimistic update can drift — e.g. when a parent gets
  // soft-deleted, the children's render conditions change.
  const refreshAllPages = useCallback(async () => {
    const last = page;
    await fetchPage(0, false);
    for (let p = 1; p <= last; p++) {
      await fetchPage(p, true);
    }
  }, [fetchPage, page]);

  useEffect(() => {
    setLoading(true);
    setPage(0);
    void fetchPage(0, false).finally(() => setLoading(false));
  }, [fetchPage]);

  const replaceComment = useCallback((id: string, partial: Partial<Comment>) => {
    setFlat((prev) => prev.map((x) => (x.id === id ? { ...x, ...partial } : x)));
  }, []);

  const upsertComment = useCallback((c: Comment) => {
    setFlat((prev) => {
      const i = prev.findIndex((x) => x.id === c.id);
      if (i >= 0) {
        const n = [...prev];
        n[i] = c;
        return n;
      }
      return [...prev, c];
    });
  }, []);

  const addComment = useCallback(
    async (c: Comment) => {
      upsertComment(c);
      await refreshCommentTotal();
    },
    [refreshCommentTotal, upsertComment],
  );

  async function loadMore() {
    const next = page + 1;
    setLoadingMore(true);
    try {
      await fetchPage(next, true);
      setPage(next);
    } finally {
      setLoadingMore(false);
    }
  }

  const patchNode = useCallback(
    (node: import("@/lib/types").CommentNode) => {
      replaceComment(node.id, {
        content: node.content,
        score: node.score,
        myVote: node.myVote,
        deleted: node.deleted,
        authorName: node.authorName,
        authorId: node.authorId,
        updatedAt: node.updatedAt,
      });
    },
    [replaceComment],
  );

  const canLoadMore = totalTop > (page + 1) * 20;

  return (
    <section id="comments" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-[var(--color-text)]">Comments</h2>
        <div className="flex rounded-full border border-[var(--color-border)] bg-[var(--color-card)] p-0.5 text-xs font-semibold">
          {(["new", "top", "old"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSort(s)}
              className={`rounded-full px-3 py-1 capitalize transition ${sort === s ? "bg-[var(--color-brand)] text-white" : "text-[var(--color-muted)] hover:text-[var(--color-text)]"}`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {currentUserId ? (
        <CommentForm
          postId={postId}
          parentId={null}
          onCreated={(c) => void addComment(normalizeComment(c))}
        />
      ) : (
        <p className="text-sm text-[var(--color-muted)]">
          <Link href="/login" className="font-semibold text-[var(--color-brand)] hover:underline">
            Sign in
          </Link>{" "}
          to comment.
        </p>
      )}

      {loading ? (
        <div className="h-24 animate-pulse rounded-xl bg-[var(--color-pill-bg)]" />
      ) : (
        <>
          <CommentThread
            postId={postId}
            nodes={tree}
            currentUserId={currentUserId}
            depth={0}
            onPatch={patchNode}
            onAdd={(c) => void addComment(normalizeComment(c))}
            onCommentMutated={refreshAllPages}
          />
          {flat.length === 0 && (
            <p className="text-center text-sm text-[var(--color-muted)] py-6">No comments yet.</p>
          )}
          {canLoadMore && (
            <button
              type="button"
              onClick={() => void loadMore()}
              disabled={loadingMore}
              className="w-full rounded-xl border border-[var(--color-border)] py-2 text-sm font-semibold text-[var(--color-brand)] hover:bg-[var(--color-hover)] disabled:opacity-50"
            >
              {loadingMore ? "Loading…" : "Load more comments"}
            </button>
          )}
        </>
      )}
    </section>
  );
}
