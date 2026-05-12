"use client";

import toast from "react-hot-toast";

import { CommunityRequestError } from "@/lib/fetchJson";

/**
 * Shows a toast for a thrown error in a way that does NOT stack on rapid
 * repeats. The toast id is derived from the error category so that:
 *
 *  - successive `RATE_LIMITED` failures replace each other and the message
 *    always shows the latest `retryAfterSeconds`;
 *  - generic action-specific failures (the `fallbackKey`) replace each other
 *    too, instead of producing one toast per click — this is the fix for
 *    the "An unexpected error occurred" stack the friend hit by spam-
 *    clicking Like.
 *
 * @param err          The thrown value (Error / unknown).
 * @param fallbackKey  Unique key for non-rate-limit failures of this call site.
 *                     e.g. `"like-error"`, `"comment-vote-error"`. Reused
 *                     across renders so consecutive errors deduplicate.
 * @param fallbackMsg  Friendly message if `err` doesn't carry one.
 */
export function showErrorToast(
  err: unknown,
  fallbackKey: string,
  fallbackMsg = "Something went wrong. Please try again.",
): void {
  if (err instanceof CommunityRequestError && err.status === 429) {
    const seconds = err.retryAfterSeconds;
    const msg = seconds
      ? `You're doing that too quickly. Try again in ${seconds}s.`
      : err.message || "You're doing that too quickly. Try again shortly.";
    // Single sticky id across the whole app — we never want two rate-limit
    // toasts stacked at once, even if the user is hammering different
    // endpoints.
    toast.error(msg, { id: "rate-limit" });
    return;
  }
  if (err instanceof CommunityRequestError && err.code === "DUPLICATE_COMMENT") {
    toast.error(err.message, { id: "duplicate-comment" });
    return;
  }
  const msg =
    err instanceof Error && err.message ? err.message : fallbackMsg;
  toast.error(msg, { id: fallbackKey });
}
