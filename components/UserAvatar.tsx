"use client";

import { getInitials } from "@/lib/auth";

/**
 * UserAvatar — renders a circular avatar from an image URL, falling back to
 * the user's initials when there's no image or the image fails to load.
 *
 * Use this anywhere the *current* user's avatar is shown in chrome/composer
 * spots (feed + group "create post" bars, etc.). It mirrors the Navbar's
 * avatar markup so the picture is consistent everywhere. `src` is normally
 * the session's avatar path (`/api/users/{id}/avatar`); a missing/404 image
 * gracefully degrades to initials.
 */
type Props = {
  src?: string | null;
  name: string;
  /** Sizing utility classes for the circle (e.g. "h-9 w-9"). */
  className?: string;
  /** Text-size utility class for the initials fallback (e.g. "text-sm"). */
  textClassName?: string;
};

export default function UserAvatar({
  src,
  name,
  className = "h-9 w-9",
  textClassName = "text-sm",
}: Props) {
  if (src) {
    return (
      <span
        className={`relative inline-block overflow-hidden rounded-full border border-[var(--color-border)] flex-shrink-0 ${className}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={name}
          className="h-full w-full object-cover"
          onError={(e) => {
            // Drop the broken image and reveal the initials fallback behind it.
            (e.currentTarget as HTMLImageElement).style.display = "none";
            const fb = e.currentTarget.nextElementSibling as HTMLElement | null;
            if (fb) fb.style.display = "flex";
          }}
        />
        <span
          style={{ display: "none" }}
          className={`absolute inset-0 items-center justify-center bg-[var(--color-brand)] font-bold text-white ${textClassName}`}
        >
          {getInitials(name)}
        </span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full bg-[var(--color-brand)] font-bold text-white flex-shrink-0 ${textClassName} ${className}`}
    >
      {getInitials(name)}
    </span>
  );
}
