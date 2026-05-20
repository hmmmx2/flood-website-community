"use client";

/**
 * <FloodAlertSubscribeButton /> — opt-in CTA for OS-level push notifications.
 *
 * Lives next to the live-updated chip on the flood-map header. When a
 * signed-in resident clicks it, we register the service worker, request
 * Notification permission, build a PushSubscription with the site's VAPID
 * key, and POST it to the Java backend. From then on, any `flood` or
 * `battery_critical` alert dispatched from the FloodWatch IoT SSE proxy
 * fans out to that subscriber even when the tab is closed.
 *
 * Anonymous users see a softer prompt: "Sign in to enable alerts" — we
 * never call subscribeToPush() for them because the backend persistence
 * step uses the NextAuth session.
 */

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import toast from "react-hot-toast";

import {
  getSubscriptionState,
  isPushSupported,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/pushNotifications";

type State =
  | "checking"
  | "unsupported"
  | "anon"
  | "subscribed"
  | "unsubscribed"
  | "denied";

function BellIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function BellOffIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      <path d="M18.63 13A17.89 17.89 0 0 1 18 8" />
      <path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14" />
      <path d="M18 8a6 6 0 0 0-9.33-5" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

export default function FloodAlertSubscribeButton() {
  const { status: sessionStatus } = useSession();
  const [state, setState] = useState<State>("checking");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!isPushSupported()) {
      setState("unsupported");
      return;
    }
    if (sessionStatus === "loading") {
      setState("checking");
      return;
    }
    if (sessionStatus !== "authenticated") {
      setState("anon");
      return;
    }
    const s = await getSubscriptionState();
    if (s.permission === "denied") setState("denied");
    else if (s.subscribed) setState("subscribed");
    else setState("unsubscribed");
  }, [sessionStatus]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onClick = useCallback(async () => {
    if (busy) return;
    if (state === "anon") {
      toast("Sign in to receive flood alerts on this device.");
      return;
    }
    if (state === "unsupported") {
      toast.error("This browser doesn't support push notifications.");
      return;
    }
    if (state === "denied") {
      toast.error(
        "Notifications were blocked. Re-enable them in your browser settings to receive flood alerts.",
      );
      return;
    }

    setBusy(true);
    try {
      if (state === "subscribed") {
        await unsubscribeFromPush();
        toast.success("Flood alerts turned off for this device.");
        setState("unsubscribed");
      } else {
        const outcome = await subscribeToPush();
        if (outcome.result === "subscribed") {
          toast.success(outcome.message);
          setState("subscribed");
        } else {
          toast.error(outcome.message, {
            duration: outcome.result === "blocked-by-os" ? 8000 : 4500,
          });
          if (outcome.result === "denied") setState("denied");
          else if (outcome.result === "unsupported") setState("unsupported");
          // For misconfigured / blocked-by-os / transient-error keep the
          // current state so the user can click again after fixing the cause.
        }
      }
    } catch (err) {
      console.error("[FloodAlertSubscribeButton] toggle failed:", err);
      toast.error("Could not update flood-alert subscription.");
    } finally {
      setBusy(false);
    }
  }, [busy, state]);

  if (state === "checking" || state === "unsupported") return null;

  const subscribed = state === "subscribed";
  const denied = state === "denied";
  const label = subscribed
    ? "Flood alerts on"
    : denied
      ? "Alerts blocked"
      : state === "anon"
        ? "Sign in for alerts"
        : "Get flood alerts";
  const titleAttr = subscribed
    ? "Click to stop receiving flood-alert push notifications on this device."
    : denied
      ? "Notifications are blocked for this site. Re-enable them in your browser's site settings to receive flood alerts."
      : state === "anon"
        ? "Sign in to receive OS-level flood-alert push notifications."
        : "Get OS-level push notifications when a flood alert fires near a saved place.";

  return (
    <button
      type="button"
      onClick={() => void onClick()}
      disabled={busy}
      title={titleAttr}
      className={[
        "hidden sm:inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
        subscribed
          ? "border-[var(--color-brand)] bg-[color-mix(in_srgb,var(--color-brand)_10%,transparent)] text-[var(--color-brand)] hover:bg-[color-mix(in_srgb,var(--color-brand)_18%,transparent)]"
          : denied
            ? "border-[var(--color-border)] text-[var(--color-muted)] opacity-70 cursor-help hover:border-[#dc2626] hover:text-[#dc2626]"
            : "border-[var(--color-border)] text-[var(--color-muted)] hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]",
        busy ? "cursor-wait opacity-70" : "",
      ].join(" ")}
      aria-pressed={subscribed}
    >
      {subscribed ? (
        <BellIcon className="h-3.5 w-3.5" />
      ) : (
        <BellOffIcon className="h-3.5 w-3.5" />
      )}
      <span>{label}</span>
    </button>
  );
}
