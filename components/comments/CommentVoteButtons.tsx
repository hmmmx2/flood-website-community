"use client";

import { useCallback, useEffect, useState } from "react";
import { authFetchJson } from "@/lib/fetchJson";

type Props = {
  postId: string;
  commentId: string;
  score: number;
  myVote: -1 | 0 | 1;
  disabled?: boolean;
  onVoteResult: (score: number, myVote: -1 | 0 | 1) => void;
};

export default function CommentVoteButtons({
  postId,
  commentId,
  score,
  myVote,
  disabled,
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
      } catch {
        setLocalScore(score);
        setLocalVote(myVote);
        onVoteResult(score, myVote);
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
    return (
      <span className="text-xs font-semibold text-[var(--color-muted)] tabular-nums">{localScore}</span>
    );
  }

  return (
    <div className="flex flex-col items-center gap-0 min-w-[28px] opacity-100">
      <button
        type="button"
        aria-label="Upvote"
        onClick={() => void up()}
        disabled={busy}
        className={`p-0.5 rounded hover:bg-[var(--color-hover)] ${localVote === 1 ? "text-[var(--color-brand)]" : "text-[var(--color-muted)]"}`}
      >
        ▲
      </button>
      <span className="text-xs font-bold text-[var(--color-text)] tabular-nums leading-none py-0.5">{localScore}</span>
      <button
        type="button"
        aria-label="Downvote"
        onClick={() => void down()}
        disabled={busy}
        className={`p-0.5 rounded hover:bg-[var(--color-hover)] ${localVote === -1 ? "text-orange-500" : "text-[var(--color-muted)]"}`}
      >
        ▼
      </button>
    </div>
  );
}
