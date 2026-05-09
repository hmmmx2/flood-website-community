"use client";

/**
 * <AvatarUploader /> — file-input based profile-picture editor.
 *
 * Picks an image, draws it into a square canvas at most 256×256, exports
 * to JPEG quality 0.85, and returns the resulting `data:image/jpeg;base64,…`
 * URL so the caller can PATCH it into the user's avatarUrl field.
 *
 * No backend storage is needed — the resized payload (~30-60 KB) fits
 * comfortably in the existing avatar_url TEXT column.
 */

import { useCallback, useRef, useState } from "react";

const MAX_DIMENSION = 256;          // square canvas side
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_INPUT_BYTES = 8 * 1024 * 1024; // 8 MB raw upload cap before resize

type Props = {
  /** Current avatar (URL or data URL) used for the preview circle. */
  value: string | null;
  /** Display name to render initials when no avatar is set. */
  fallbackName: string;
  /** Called once a new avatar has been encoded. The caller persists it. */
  onChange: (dataUrl: string) => Promise<void> | void;
  /** Called when the user clears the avatar. */
  onClear?: () => Promise<void> | void;
  /** Optional extra wrapper class. */
  className?: string;
};

function getInitials(name: string): string {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? "")
    .join("") || name[0]?.toUpperCase() || "?";
}

/**
 * Resize + compress to a square JPEG data URL. Center-crops so the avatar
 * stays circular without distortion.
 */
async function fileToResizedJpegDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const sx = Math.floor((bitmap.width - side) / 2);
  const sy = Math.floor((bitmap.height - side) / 2);

  const canvas = document.createElement("canvas");
  canvas.width = MAX_DIMENSION;
  canvas.height = MAX_DIMENSION;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported in this browser.");
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, MAX_DIMENSION, MAX_DIMENSION);
  bitmap.close?.();
  return canvas.toDataURL("image/jpeg", 0.85);
}

export default function AvatarUploader({
  value,
  fallbackName,
  onChange,
  onClear,
  className = "",
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickFile = useCallback(() => {
    setError(null);
    fileInputRef.current?.click();
  }, []);

  async function handleFile(file: File) {
    setError(null);
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Please choose a JPEG, PNG, or WebP image.");
      return;
    }
    if (file.size > MAX_INPUT_BYTES) {
      setError("Image is too large (max 8 MB before resize).");
      return;
    }
    setBusy(true);
    try {
      const dataUrl = await fileToResizedJpegDataUrl(file);
      await onChange(dataUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't process image.");
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function clear() {
    if (!onClear) return;
    setError(null);
    setBusy(true);
    try {
      await onClear();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`flex items-center gap-4 ${className}`}>
      {/* Preview circle */}
      <div className="relative h-20 w-20 flex-shrink-0">
        <div className="h-full w-full rounded-full overflow-hidden bg-[var(--color-brand)]/15 flex items-center justify-center text-2xl font-bold text-[var(--color-brand)] ring-2 ring-[var(--color-border)]">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={value}
              alt={fallbackName}
              className="h-full w-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            getInitials(fallbackName)
          )}
        </div>
        {busy && (
          <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
            <span className="h-5 w-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={pickFile}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-brand)] px-4 py-1.5 text-xs font-bold text-white hover:bg-[var(--color-brand-dark)] disabled:opacity-50 transition"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-3.5 w-3.5"
              aria-hidden
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            {value ? "Change photo" : "Upload photo"}
          </button>
          {value && onClear && (
            <button
              type="button"
              onClick={() => void clear()}
              disabled={busy}
              className="inline-flex items-center rounded-full border border-[var(--color-border)] px-4 py-1.5 text-xs font-semibold text-[var(--color-muted)] hover:bg-[var(--color-pill-bg)] hover:text-[var(--color-text)] disabled:opacity-50 transition"
            >
              Remove
            </button>
          )}
        </div>
        <p className="mt-2 text-[11px] text-[var(--color-muted)]">
          JPEG / PNG / WebP, up to 8 MB. We&apos;ll resize and crop to a 256×256 square.
        </p>
        {error && (
          <p className="mt-1 text-[11px] font-semibold text-red-500">{error}</p>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={ALLOWED_TYPES.join(",")}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
        }}
      />
    </div>
  );
}
