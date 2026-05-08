"use client";

/**
 * <ReportPostModal /> — modal that lets a community user flag a post
 * for admin review. Submits to /api/community/posts/{id}/report which
 * proxies to the Java service. Backend filters duplicate reports per
 * (user, post) so tapping twice just shows a friendly conflict toast.
 */

import { useEffect, useState, type FormEvent } from "react";
import toast from "react-hot-toast";
import { authFetchJson } from "@/lib/fetchJson";

const REASONS: { value: string; label: string; help: string }[] = [
  { value: "spam",           label: "Spam or scam",        help: "Repeated promo, phishing, off-platform redirects." },
  { value: "harassment",     label: "Harassment / hate",   help: "Targeted insults, threats, doxxing." },
  { value: "misinformation", label: "Flood misinformation", help: "False or misleading flood claims." },
  { value: "off-topic",      label: "Off-topic",           help: "Unrelated to the FloodWatch community." },
  { value: "other",          label: "Other",               help: "Please describe in the box below." },
];

type Props = {
  postId: string;
  postTitle: string;
  onClose: () => void;
};

export default function ReportPostModal({ postId, postTitle, onClose }: Props) {
  const [reason, setReason] = useState<string>("");
  const [details, setDetails] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!reason) {
      toast.error("Pick a reason first.");
      return;
    }
    setSubmitting(true);
    try {
      await authFetchJson(`/api/community/posts/${postId}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, details: details.trim() || undefined }),
      });
      toast.success("Reported. An admin will review shortly.");
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Couldn't send your report.";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-xl">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-[var(--color-text)]">Report post</h3>
            <p className="mt-0.5 truncate text-[11px] text-[var(--color-muted)]">{postTitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-[var(--color-muted)] hover:text-[var(--color-text)] p-1"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4 p-5">
          <fieldset className="space-y-2">
            <legend className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
              Why are you reporting this?
            </legend>
            {REASONS.map((r) => (
              <label
                key={r.value}
                className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 transition ${
                  reason === r.value
                    ? "border-[var(--color-brand)] bg-[var(--color-brand)]/10"
                    : "border-[var(--color-border)] hover:bg-[var(--color-hover)]"
                }`}
              >
                <input
                  type="radio"
                  name="reason"
                  value={r.value}
                  checked={reason === r.value}
                  onChange={(e) => setReason(e.target.value)}
                  className="mt-0.5 accent-[var(--color-brand)]"
                />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[var(--color-text)]">{r.label}</p>
                  <p className="mt-0.5 text-[11px] text-[var(--color-muted)]">{r.help}</p>
                </div>
              </label>
            ))}
          </fieldset>

          <div>
            <label htmlFor="report-details" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
              Additional details (optional)
            </label>
            <textarea
              id="report-details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Anything the moderator should know."
              className="w-full resize-y rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-brand)]/15"
            />
            <p className="mt-1 text-right text-[10px] text-[var(--color-muted)]">{details.length}/500</p>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full px-4 py-1.5 text-xs font-semibold text-[var(--color-muted)] hover:bg-[var(--color-pill-bg)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!reason || submitting}
              className="rounded-full bg-red-500 px-4 py-1.5 text-xs font-bold text-white hover:bg-red-600 disabled:opacity-50"
            >
              {submitting ? "Sending…" : "Submit report"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
