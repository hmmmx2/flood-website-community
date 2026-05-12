/**
 * Shared layout primitives so the navbar and every page agree on
 * one outer width. The flood-map sets the high-water mark at
 * Tailwind's `max-w-7xl` (1280px), so the rest of the site follows
 * suit to avoid the patchwork of max-w-3xl / 5xl / 7xl we used to
 * have. Use {@link PAGE_CONTAINER} on the outer <main>; if the
 * specific content (forms, prose, threaded posts) reads better at
 * a narrower measure, drop a {@link READABLE_CONTAINER} wrapper
 * inside it without changing the outer chrome.
 */

/** Outermost page container — matches the navbar and the flood-map. */
export const PAGE_CONTAINER = "mx-auto w-full max-w-7xl px-4 sm:px-6";

/** Narrower inner container for forms, post threads, articles. */
export const READABLE_CONTAINER = "mx-auto w-full max-w-3xl";
