"use client";

import { useCallback, useEffect, useState } from "react";
import { authFetchJson } from "@/lib/fetchJson";
import { showErrorToast } from "@/lib/errorToast";

type Variant = "stacked" | "inline";

type Props = {
  postId: string;
  commentId: string;
  score: number;
  myVote: -1 | 0 | 1;
  disabled?: boolean;
  /** "stacked" = old Reddit-style column (still used by some surfaces).
   *  "inline" = horizontal row used inside the new comment action bar. */
  variant?: Variant;
  onVoteResult: (score: number, myVote: -1 | 0 | 1) => void;
};

export default function CommentVoteButtons({
  postId,
  commentId,
  score,
  myVote,
  disabled,
  variant = "stacked",
  onVoteResult,
}: Props) {
  const [localScore, setLocalScore] = useState(score);
  const [localVote, setLocalVote] = useState(myVote);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setLocalScore(score);
    setLocalVote(myVote);
  }, [score, myVote]);

  const apply = useCallback(
    async (value: -1 | 0 | 1) => {
      setBusy(true);
      try {
        const res = await authFetchJson<{ score: number; myVote: number }>(
          `/api/posts/${postId}/comments/${commentId}/vote`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ value }),
          },
        );
        const mv = Math.min(1, Math.max(-1, res.myVote ?? 0)) as -1 | 0 | 1;
        setLocalScore(res.score);
        setLocalVote(mv);
        onVoteResult(res.score, mv);
      } catch (err) {
        // Rollback optimistic state on server failure, then surface the
        // error in a way that dedupes across rapid clicks (and shares the
        // single sticky "rate-limit" id with the Like button).
        setLocalScore(score);
        setLocalVote(myVote);
        onVoteResult(score, myVote);
        showErrorToast(err, "comment-vote-error", "Couldn't register vote.");
      } finally {
        setBusy(false);
      }
    },
    [commentId, postId, score, myVote, onVoteResult],
  );

  async function up() {
    if (disabled || busy) return;
    const prev = localVote;
    const next: -1 | 0 | 1 = prev === 1 ? 0 : 1;
    setLocalVote(next);
    setLocalScore((s) => s + (next - prev));
    await apply(next);
  }

  async function down() {
    if (disabled || busy) return;
    const prev = localVote;
    const next: -1 | 0 | 1 = prev === -1 ? 0 : -1;
    setLocalVote(next);
    setLocalScore((s) => s + (next - prev));
    await apply(next);
  }

  if (disabled) {
    if (variant === "inline") {
      return (
        <span className="px-2 py-0.5 rounded-full text-[var(--color-muted)] tabular-nums">
          {localScore}
        </span>
      );
    }
    return (
      <span className="text-xs font-semibold text-[var(--color-muted)] tabular-nums">
        {localScore}
      </span>
    );
  }

  if (variant === "inline") {
    return (
      <div className="flex items-center">
        <button
          type="button"
          aria-label="Upvote"
          aria-pressed={localVote === 1}
          onClick={() => void up()}
          disabled={busy}
          className={`flex items-center gap-1 rounded-full px-2 py-0.5 transition-colors ${
            localVote === 1
              ? "text-[var(--color-brand)]"
              : "hover:bg-[var(--color-pill-bg)] hover:text-[var(--color-text)]"
          }`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill={localVote === 1 ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-3.5 w-3.5"
            aria-hidden
          >
            <path d="M7 11V21H4a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1h3z" />
            <path d="M7 11l4-7a2 2 0 0 1 2 2v3h5.5a2 2 0 0 1 1.94 2.5l-1.7 7A2 2 0 0 1 16.8 21H7" />
          </svg>
          <span className="tabular-nums">{localScore}</span>
        </button>
        <button
          type="button"
          aria-label="Downvote"
          aria-pressed={localVote === -1}
          onClick={() => void down()}
          disabled={busy}
          className={`rounded-full px-2 py-0.5 transition-colors ${
            localVote === -1
              ? "text-orange-500"
              : "hover:bg-[var(--color-pill-bg)] hover:text-[var(--color-text)]"
          }`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill={localVote === -1 ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-3.5 w-3.5"
            aria-hidden
          >
            <path d="M17 13V3h3a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-3z" />
            <path d="M17 13l-4 7a2 2 0 0 1-2-2v-3H5.5a2 2 0 0 1-1.94-2.5l1.7-7A2 2 0 0 1 7.2 3H17" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-0 min-w-[28px] opacity-100">
      <button
        type="button"
        aria-label="Upvote"
        onClick={() => void up()}
        disabled={busy}
        className={`p-0.5 rounded hover:bg-[var(--color-hover)] ${
          localVote === 1 ? "text-[var(--color-brand)]" : "text-[var(--color-muted)]"
        }`}
      >
        ▲
      </button>
      <span className="text-xs font-bold text-[var(--color-text)] tabular-nums leading-none py-0.5">
        {localScore}
      </span>
      <button
        type="button"
        aria-label="Downvote"
        onClick={() => void down()}
        disabled={busy}
        className={`p-0.5 rounded hover:bg-[var(--color-hover)] ${
          localVote === -1 ? "text-orange-500" : "text-[var(--color-muted)]"
        }`}
      >
        ▼
      </button>
    </div>
  );
}
