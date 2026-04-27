"use client";

import { useEffect, useRef, useState } from "react";
import type { Group } from "@/lib/types";

type Props = {
  token: string;
  onClose: () => void;
  onCreated: (post: unknown) => void;
  defaultGroupSlug?: string;
};

export default function CreatePostModal({ token, onClose, onCreated, defaultGroupSlug }: Props) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [groupSlug, setGroupSlug] = useState<string>(defaultGroupSlug ?? "");
  const [groups, setGroups] = useState<Group[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/groups", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : [])
      .then((data: Group[]) => setGroups(data))
      .catch(() => {});
  }, [token]);

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
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: title.trim(),
          content: content.trim(),
          imageUrl,
          groupSlug: groupSlug || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to create post"); setLoading(false); return; }
      onCreated(data);
      onClose();
    } catch { setError("Connection error"); setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
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
              maxLength={500}
              placeholder="An interesting title"
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] px-4 py-3 text-sm font-semibold outline-none focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-brand)]/10 placeholder:font-normal"
            />
            <p className="text-right text-[11px] text-[var(--color-muted)] mt-1">{title.length}/500</p>
          </div>

          {/* Content */}
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            rows={6}
            placeholder="Share your flood update, safety tip, or community notice…"
            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] px-4 py-3 text-sm outline-none focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-brand)]/10 resize-none"
          />

          {/* Image upload */}
          {imageUrl ? (
            <div className="relative rounded-xl overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl} alt="Preview" className="w-full max-h-64 object-cover" />
              <button type="button" onClick={() => setImageUrl(null)}
                className="absolute top-2 right-2 h-7 w-7 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition text-xs font-bold">
                ✕
              </button>
            </div>
          ) : (
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
              onClick={() => fileRef.current?.click()}
              className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed py-8 transition-colors ${
                dragOver ? "border-[var(--color-brand)] bg-red-50" : "border-[var(--color-border)] bg-[var(--color-pill-bg)] hover:border-[var(--color-brand)]/50"
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
            <button type="submit" disabled={!title.trim() || !content.trim() || loading}
              className="rounded-full bg-[var(--color-brand)] px-6 py-2.5 text-sm font-bold text-white transition hover:bg-[var(--color-brand-dark)] disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? "Publishing…" : "Post"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
