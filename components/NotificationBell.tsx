"use client";

/**
 * <NotificationBell /> — bell icon + dropdown that lives in the navbar.
 *
 * Behaviour:
 *   • Polls /api/notifications on mount and after each open.
 *   • Subscribes to /api/sse/notifications for live pushes (server-side
 *     proxy attaches the user's bearer token; the browser's EventSource
 *     can't add headers itself).
 *   • Plays a soft 2-tone bell when a new notification arrives, ONLY
 *     after the user has interacted with the page once (browser auto-
 *     play policy). The sound is generated via Web Audio API — no asset
 *     file required.
 *   • Click a row to mark it read and follow its deep-link.
 *
 * The badge stays in sync with `unread`. Closes on outside click + Esc.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Notification = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  severity: "info" | "warning" | "critical" | string;
  readAt: string | null;
  createdAt: string;
};

type Page<T> = {
  content: T[];
  totalElements?: number;
  totalPages?: number;
  number?: number;
  size?: number;
  last?: boolean;
};

interface Props {
  /** When false, the component renders nothing (anonymous user). */
  enabled?: boolean;
}

export default function NotificationBell({ enabled = true }: Props) {
  const [open, setOpen]               = useState(false);
  const [items, setItems]             = useState<Notification[]>([]);
  const [unread, setUnread]           = useState(0);
  const [loading, setLoading]         = useState(false);
  const userInteracted                = useRef(false);
  const audioCtx                      = useRef<AudioContext | null>(null);
  const wrapperRef                    = useRef<HTMLDivElement>(null);

  // Track user interaction once — required for autoplay-protected sound.
  useEffect(() => {
    const flag = () => { userInteracted.current = true; };
    window.addEventListener("pointerdown", flag, { once: true });
    window.addEventListener("keydown",     flag, { once: true });
    return () => {
      window.removeEventListener("pointerdown", flag);
      window.removeEventListener("keydown",     flag);
    };
  }, []);

  // ── Bell sound ────────────────────────────────────────────────────────────
  // Two short FM-synth tones (high-low) using a sine carrier through a gain
  // envelope. ~300ms total; deliberately gentle to not startle.
  const playBell = useCallback(() => {
    if (!userInteracted.current) return;          // browser will block; skip silently
    if (typeof window === "undefined") return;
    try {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      if (!audioCtx.current) audioCtx.current = new Ctor();
      const ctx = audioCtx.current;
      if (ctx.state === "suspended") void ctx.resume();

      const tone = (freq: number, start: number, dur: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        osc.connect(gain);
        gain.connect(ctx.destination);
        gain.gain.setValueAtTime(0.0001, ctx.currentTime + start);
        gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + start + dur + 0.05);
      };
      tone(880, 0,    0.18);   // A5 — first ding
      tone(659, 0.13, 0.22);   // E5 — second ding
    } catch { /* audio is best-effort */ }
  }, []);

  // ── Initial load + unread count ───────────────────────────────────────────
  const loadList = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const r = await fetch("/api/notifications?page=0&size=20", {
        credentials: "include",
        cache: "no-store",
      });
      if (!r.ok) {
        if (r.status === 401) { setItems([]); setUnread(0); return; }
        return;
      }
      const data = (await r.json()) as Page<Notification>;
      const list = data.content ?? [];
      setItems(list);
      setUnread(list.filter(n => !n.readAt).length);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  const refreshUnread = useCallback(async () => {
    if (!enabled) return;
    try {
      const r = await fetch("/api/notifications/unread-count", {
        credentials: "include",
        cache: "no-store",
      });
      if (!r.ok) return;
      const { count } = (await r.json()) as { count: number };
      setUnread(count);
    } catch { /* non-critical */ }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    void loadList();
  }, [enabled, loadList]);

  // ── Live SSE subscription ─────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined") return;
    const es = new EventSource("/api/sse/notifications");
    es.addEventListener("notification", (ev: MessageEvent) => {
      try {
        const n = JSON.parse(ev.data) as Notification;
        setItems(prev => {
          if (prev.some(p => p.id === n.id)) return prev;
          return [n, ...prev].slice(0, 20);
        });
        if (!n.readAt) setUnread(c => c + 1);
        playBell();
      } catch { /* ignore malformed payload */ }
    });
    es.onerror = () => {
      // Don't spam — let EventSource auto-reconnect.
    };
    return () => es.close();
  }, [enabled, playBell]);

  // ── Outside-click + Esc to close ──────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // ── Mark read ─────────────────────────────────────────────────────────────
  // Returns a Promise so the click handler can await persistence before
  // navigating. Without that await, navigation can race the POST and the
  // bell on the next page re-fetches with the row still unread.
  const markRead = useCallback(async (id: string) => {
    // Optimistic local update first so the badge clears instantly even
    // if the network round-trip is slow.
    setItems(prev => prev.map(n => n.id === id ? { ...n, readAt: new Date().toISOString() } : n));
    setUnread(c => Math.max(0, c - 1));
    try {
      await fetch(`/api/notifications/${encodeURIComponent(id)}/read`, {
        method: "POST",
        credentials: "include",
        keepalive: true, // survives the impending navigation
      });
    } catch { /* server-side retry is fine — local state already cleared */ }
  }, []);

  async function markAllRead() {
    setItems(prev => prev.map(n => n.readAt ? n : { ...n, readAt: new Date().toISOString() }));
    setUnread(0);
    try {
      await fetch("/api/notifications/read-all", {
        method: "POST",
        credentials: "include",
      });
    } catch { /* optimistic */ }
  }

  if (!enabled) return null;

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next) { void refreshUnread(); void loadList(); }
        }}
        aria-label={`Notifications${unread > 0 ? ` — ${unread} unread` : ""}`}
        aria-expanded={open}
        className="relative flex h-10 w-10 items-center justify-center rounded-full text-[var(--color-text)] hover:bg-[var(--color-hover)] transition"
      >
        <BellIcon className="h-5 w-5" />
        {unread > 0 && (
          <span
            className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white"
            aria-hidden
          >
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 top-12 z-50 w-[360px] max-w-[calc(100vw-1rem)] overflow-hidden rounded-2xl border bg-[var(--color-card)] shadow-xl"
          style={{ borderColor: "var(--color-border)" }}
        >
          <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: "var(--color-border)" }}>
            <p className="text-sm font-bold" style={{ color: "var(--color-text)" }}>Notifications</p>
            {unread > 0 && (
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="text-[11px] font-semibold"
                style={{ color: "var(--color-brand)" }}
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {loading && items.length === 0 && (
              <p className="px-4 py-6 text-center text-xs" style={{ color: "var(--color-muted)" }}>Loading…</p>
            )}
            {!loading && items.length === 0 && (
              <div className="px-4 py-8 text-center">
                <BellIcon className="mx-auto mb-2 h-7 w-7" style={{ color: "var(--color-border)" }} />
                <p className="text-xs" style={{ color: "var(--color-muted)" }}>You&apos;re all caught up.</p>
              </div>
            )}
            <ul>
              {items.map(n => (
                <li key={n.id}>
                  <Row notification={n} onMarkRead={() => markRead(n.id)} onClose={() => setOpen(false)} />
                </li>
              ))}
            </ul>
          </div>

          <div className="border-t px-4 py-2 text-center" style={{ borderColor: "var(--color-border)" }}>
            <Link
              href="/settings#notifications"
              onClick={() => setOpen(false)}
              className="text-[11px] font-semibold"
              style={{ color: "var(--color-brand)" }}
            >
              Notification settings
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Row ──────────────────────────────────────────────────────────────────────
function Row({
  notification,
  onMarkRead,
  onClose,
}: {
  notification: Notification;
  onMarkRead: () => Promise<void>;
  onClose: () => void;
}) {
  const router = useRouter();
  const tone =
    notification.severity === "critical" ? { bg: "rgba(220, 38, 38, 0.08)", border: "#dc2626", label: "Critical" } :
    notification.severity === "warning"  ? { bg: "rgba(249, 115, 22, 0.08)", border: "#f97316", label: "Warning" } :
                                           { bg: "rgba(56, 139, 253, 0.06)", border: "#388bfd", label: "Info" };
  const isUnread = !notification.readAt;

  const inner = (
    <div
      className="flex gap-3 px-4 py-3 transition hover:bg-[var(--color-hover)]"
      style={isUnread ? { background: tone.bg } : undefined}
    >
      <span
        className="mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full"
        style={{ backgroundColor: isUnread ? tone.border : "transparent",
                 border: isUnread ? "none" : "1px solid var(--color-border)" }}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold" style={{ color: "var(--color-text)" }}>
          {notification.title}
        </p>
        {notification.body && (
          <p className="mt-0.5 line-clamp-2 text-[11px]" style={{ color: "var(--color-muted)" }}>
            {notification.body}
          </p>
        )}
        <p className="mt-1 text-[10px]" style={{ color: "var(--color-muted)" }}>
          {formatRelative(notification.createdAt)}
        </p>
      </div>
    </div>
  );

  // Awaiting markRead before navigating guarantees the row is persisted
  // as read by the time the next page mounts and re-fetches; otherwise
  // the new bell can race the POST and re-show the unread badge.
  const link = notification.link ?? null;
  return (
    <button
      type="button"
      onClick={async () => {
        onClose();
        await onMarkRead();
        if (link) router.push(link);
      }}
      className="block w-full text-left"
    >
      {inner}
    </button>
  );
}

function BellIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

function formatRelative(iso: string): string {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}
