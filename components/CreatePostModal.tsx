"use client";

import { useEffect, useRef, useState } from "react";
import type { Group } from "@/lib/types";
import { fetchJson, authFetchJson } from "@/lib/fetchJson";
import { CloseIcon } from "@/components/icons";

type Props = {
  onClose: () => void;
  onCreated: (post: unknown) => void;
  defaultGroupSlug?: string;
};

// Caps mirror the backend DTO `CreateCommunityPostRequest`. Keep these
// in sync — the server enforces these via @Size and will 400 anything
// over the cap; the frontend just gives feedback before the round-trip.
const TITLE_MAX = 120;
const CONTENT_MAX = 4000;

export default function CreatePostModal({ onClose, onCreated, defaultGroupSlug }: Props) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [groupSlug, setGroupSlug] = useState<string>(defaultGroupSlug ?? "");
  const [groups, setGroups] = useState<Group[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Counter colour: amber at 90%, red at 100% (matches the harden-plan spec).
  const titleTone =
    title.length >= TITLE_MAX ? "text-red-500" :
    title.length >= TITLE_MAX * 0.9 ? "text-amber-500" :
    "text-[var(--color-muted)]";
  const contentTone =
    content.length >= CONTENT_MAX ? "text-red-500" :
    content.length >= CONTENT_MAX * 0.9 ? "text-amber-500" :
    "text-[var(--color-muted)]";

  useEffect(() => {
    void (async () => {
      try {
        const data = await fetchJson<Group[]>("/api/groups");
        setGroups(Array.isArray(data) ? data : []);
      } catch {
        setGroups([]);
      }
    })();
  }, []);

  function handleFile(file: File) {
    if (!file.type.startsWith("image/")) { setError("Only image files are allowed"); return; }
    if (file.size > 5 * 1024 * 1024) { setError("Image must be under 5 MB"); return; }
    const reader = new FileReader();
    reader.onload = e => setImageUrl(e.target?.result as string);
    reader.readAsDataURL(file);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !content.trim()) { setError("Title and content are required"); return; }
    setError(null);
    setLoading(true);
    try {
      const data = await authFetchJson<Record<string, unknown>>("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          content: content.trim(),
          imageUrl,
          groupSlug: groupSlug || null,
        }),
      });
      onCreated(data);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create post");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-2xl bg-[var(--color-card)] rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
          <h2 className="font-bold text-[var(--color-text)] text-lg">Create Post</h2>
          <button type="button" onClick={onClose} className="text-[var(--color-muted)] hover:text-[var(--color-text)] transition">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          {/* Group selector */}
          <div>
            <label className="block text-xs font-semibold text-[var(--color-muted)] mb-1.5">Post to</label>
            <select
              value={groupSlug}
              onChange={e => setGroupSlug(e.target.value)}
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] px-4 py-2.5 text-sm outline-none focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-brand)]/10"
            >
              <option value="">FloodWatch (global feed)</option>
              {groups.map(g => (
                <option key={g.id} value={g.slug}>g/{g.slug} — {g.name}</option>
              ))}
            </select>
          </div>

          {/* Title */}
          <div>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              maxLength={TITLE_MAX}
              placeholder="An interesting title"
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] px-4 py-3 text-sm font-semibold outline-none focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-brand)]/10 placeholder:font-normal"
            />
            <p className={`text-right text-[11px] mt-1 tabular-nums ${titleTone}`}>
              {title.length} / {TITLE_MAX}
            </p>
          </div>

          {/* Content */}
          <div>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              rows={6}
              maxLength={CONTENT_MAX}
              placeholder="Share your flood update, safety tip, or community notice…"
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] px-4 py-3 text-sm outline-none focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-brand)]/10 resize-none"
            />
            <p className={`text-right text-[11px] mt-1 tabular-nums ${contentTone}`}>
              {content.length} / {CONTENT_MAX}
            </p>
          </div>

          {/* Image upload */}
          {imageUrl ? (
            <div className="relative rounded-xl overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl} alt="Preview" className="w-full max-h-64 object-cover" />
              <button type="button" onClick={() => setImageUrl(null)}
                aria-label="Remove image"
                className="absolute top-2 right-2 h-7 w-7 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition">
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
              onClick={() => fileRef.current?.click()}
              className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed py-8 transition-colors ${
                dragOver ? "border-[var(--color-brand)] bg-[var(--color-hover)]" : "border-[var(--color-border)] bg-[var(--color-pill-bg)] hover:border-[var(--color-brand)]/50"
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-8 w-8 text-[var(--color-muted)]">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              </svg>
              <p className="text-sm text-[var(--color-muted)]">Drag & drop an image, or <span className="text-[var(--color-brand)] font-semibold">browse</span></p>
              <p className="text-xs text-[var(--color-muted)]">JPG, PNG, WEBP — max 5 MB</p>
              <input ref={fileRef} type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} className="hidden" />
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="rounded-full border border-[var(--color-border)] px-5 py-2.5 text-sm font-semibold text-[var(--color-muted)] hover:bg-[var(--color-pill-bg)] transition">
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                !title.trim() || !content.trim() || loading ||
                title.length > TITLE_MAX || content.length > CONTENT_MAX
              }
              className="rounded-full bg-[var(--color-brand)] px-6 py-2.5 text-sm font-bold text-white transition hover:bg-[var(--color-brand-dark)] disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? "Publishing…" : "Post"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
