"use client";

/**
 * SensorStreamProvider — community real-time flood early-warning system.
 *
 * Subscribes to /api/sse/sensors and surfaces three things:
 *   1. A `subscribeSensorUpdates(cb)` hook for any chart/map that wants
 *      live "sensor-update" events from the SSE stream.
 *   2. A top-right toast dock (FloodAlertDock) with severity-coloured
 *      cards — appears whenever the upstream Java service emits a
 *      `flood-alert` SSE event (≥ 1 ft water level crossed).
 *   3. Optional browser Notification API + audio chime (Web Audio synth)
 *      when the page is backgrounded / minimised — modelled on the way
 *      Japan's earthquake early-warning system gets a desktop
 *      notification + chime even if the resident is on a different tab.
 *
 * VAPID push notifications (lib/pushNotifications.ts + public/sw.js)
 * cover the OS-level alert when the website is closed entirely.
 *
 * This file is mounted once in app/layout.tsx so the dock surfaces on
 * every public + authed page.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";

// ── Public types ────────────────────────────────────────────────────────────

/** Matches flood-service-community FloodAlertDto JSON. */
export type FloodAlertPayload = {
  id: number;
  type: "flood_alert";
  nodeId: string;
  nodeName: string;
  waterLevelFeet: number;
  severity: "WATCH" | "WARNING" | "CRITICAL";
  zone: string | null;
  timestamp: string | null;
  acknowledged: boolean;
};

type SensorUpdatePayload = Record<string, unknown>;

type SensorStreamContextValue = {
  subscribeSensorUpdates: (cb: (node: SensorUpdatePayload) => void) => () => void;
  /** UI affordance to enable browser Notification + audio chime. */
  enableDesktopAlerts: () => void;
  desktopAlertsEnabled: boolean;
  /** Currently-visible alerts, exposed for any header/badge UI that wants it. */
  activeAlertCount: number;
};

const SensorStreamContext = createContext<SensorStreamContextValue | null>(null);

export function useSensorStream(): SensorStreamContextValue {
  const ctx = useContext(SensorStreamContext);
  if (!ctx) {
    throw new Error("useSensorStream must be used within SensorStreamProvider");
  }
  return ctx;
}

// ── Severity styling — aligned with the project emergency palette ──────────

function severityTone(sev: FloodAlertPayload["severity"]) {
  switch (sev) {
    case "CRITICAL":
      return {
        bar: "bg-[#dc2626]",
        accent: "#dc2626",
        copy: "text-white",
        surface: "linear-gradient(135deg, #450a0a, #7f1d1d 70%, #b91c1c)",
        glow: "shadow-[0_0_24px_-4px_rgba(220,38,38,0.55)]",
        pulse: true,
      };
    case "WARNING":
      return {
        bar: "bg-[#f97316]",
        accent: "#f97316",
        copy: "text-white",
        surface: "linear-gradient(135deg, #431407, #9a3412 70%, #ea580c)",
        glow: "shadow-[0_0_18px_-4px_rgba(249,115,22,0.45)]",
        pulse: false,
      };
    default:
      return {
        bar: "bg-[#f59e0b]",
        accent: "#f59e0b",
        copy: "text-white",
        surface: "linear-gradient(135deg, #451a03, #92400e 70%, #d97706)",
        glow: "shadow-[0_0_14px_-4px_rgba(245,158,11,0.4)]",
        pulse: false,
      };
  }
}

function severityLabel(sev: FloodAlertPayload["severity"]): string {
  if (sev === "CRITICAL") return "Critical";
  if (sev === "WARNING")  return "Warning";
  return "Alert";
}

function timeSince(iso: string | null): string {
  if (!iso) return "just now";
  const diffMs = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diffMs) || diffMs < 0) return "just now";
  const s = Math.floor(diffMs / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── Audio chime (Web Audio synth — no asset file required) ──────────────────

function playEewChime(severity: FloodAlertPayload["severity"]) {
  if (typeof window === "undefined") return;
  try {
    const Ctx = (window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
    if (!Ctx) return;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    const beep = (freq: number, start: number, duration: number, gain: number) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0, now + start);
      g.gain.linearRampToValueAtTime(gain, now + start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + start + duration);
      osc.connect(g).connect(ctx.destination);
      osc.start(now + start);
      osc.stop(now + start + duration + 0.05);
    };
    beep(880, 0,    0.18, 0.18);
    beep(660, 0.22, 0.22, 0.18);
    if (severity === "CRITICAL") beep(990, 0.5, 0.28, 0.22);
    setTimeout(() => { ctx.close().catch(() => {}); }, 1500);
  } catch {
    /* audio is best-effort */
  }
}

// ── Browser Notification helper ────────────────────────────────────────────

function showDesktopNotification(payload: FloodAlertPayload) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  if (typeof document !== "undefined" && document.visibilityState === "visible") return;
  try {
    const n = new Notification(`Flood ${severityLabel(payload.severity)} — ${payload.nodeName || payload.nodeId}`, {
      body: `Water level ${payload.waterLevelFeet.toFixed(1)} ft · Zone ${payload.zone ?? "—"}`,
      tag: `flood-alert-${payload.id}`,
      requireInteraction: payload.severity === "CRITICAL",
      silent: false,
    });
    n.onclick = () => {
      window.focus();
      window.location.href = "/flood-map";
      n.close();
    };
  } catch {
    /* permission revoked between the check and call — ignore */
  }
}

// ── FloodAlertDock — the visible toast stack ────────────────────────────────

function FloodAlertDock({
  alerts,
  onDismiss,
  onDismissAll,
}: {
  alerts: FloodAlertPayload[];
  onDismiss: (id: number) => void;
  onDismissAll: () => void;
}) {
  // Keep the time-since labels live without re-running the SSE effect.
  const [, force] = useState(0);
  useEffect(() => {
    if (alerts.length === 0) return;
    const t = window.setInterval(() => force((n) => n + 1), 30_000);
    return () => window.clearInterval(t);
  }, [alerts.length]);

  if (alerts.length === 0) return null;

  const highestSeverity: FloodAlertPayload["severity"] = alerts.some((a) => a.severity === "CRITICAL")
    ? "CRITICAL"
    : alerts.some((a) => a.severity === "WARNING")
      ? "WARNING"
      : "WATCH";

  const headerTone = severityTone(highestSeverity);

  return (
    <div
      className="fixed top-20 right-4 z-[200] flex max-h-[85vh] w-[min(100vw-2rem,22rem)] flex-col gap-2 overflow-y-auto pointer-events-none"
      aria-live="assertive"
      aria-relevant="additions"
    >
      {/* Header bar — total count + dismiss-all */}
      <div
        className="pointer-events-auto flex items-center justify-between rounded-xl border px-3 py-2 backdrop-blur-md"
        style={{
          background: "rgba(15, 23, 42, 0.85)",
          borderColor: headerTone.accent,
        }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`inline-block h-2.5 w-2.5 rounded-full ${headerTone.pulse ? "animate-pulse" : ""}`}
            style={{ background: headerTone.accent, boxShadow: `0 0 8px ${headerTone.accent}` }}
            aria-hidden
          />
          <span className="text-xs font-bold uppercase tracking-wider text-white">
            {alerts.length} ACTIVE FLOOD {alerts.length === 1 ? "ALERT" : "ALERTS"}
          </span>
        </div>
        <button
          type="button"
          onClick={onDismissAll}
          className="shrink-0 rounded-lg px-2 py-1 text-[11px] font-semibold text-white/80 transition hover:bg-white/10"
        >
          Dismiss all
        </button>
      </div>

      {/* Alert cards */}
      {alerts.map((a) => {
        const tone = severityTone(a.severity);
        return (
          <div
            key={`${a.id}-${a.timestamp ?? ""}`}
            role="alert"
            className={`pointer-events-auto relative overflow-hidden rounded-xl border-2 ${tone.copy} ${tone.glow} ${tone.pulse ? "animate-flood-pulse" : ""}`}
            style={{
              background: tone.surface,
              borderColor: tone.accent,
              animation: "flood-toast-in 280ms cubic-bezier(0.16,1,0.3,1)",
            }}
          >
            <div className={`absolute left-0 top-0 h-full w-1 ${tone.bar}`} aria-hidden />
            <div className="flex items-start justify-between gap-2 px-4 py-3 pl-5">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-95">
                  Flood Advisory · {severityLabel(a.severity)}
                </p>
                <p className="mt-1 text-sm font-semibold leading-snug">
                  {a.nodeName || a.nodeId}
                </p>
                <p className="mt-0.5 text-xs opacity-95">
                  Water level{" "}
                  <span className="font-bold">{a.waterLevelFeet.toFixed(1)} ft</span>{" "}
                  · Zone {a.zone ?? "—"}
                </p>
                <div className="mt-2 flex items-center justify-between gap-2 text-[11px] opacity-90">
                  <Link
                    href="/flood-map"
                    className="font-bold underline underline-offset-2 hover:opacity-100"
                  >
                    View live sensors →
                  </Link>
                  <span className="tabular-nums">{timeSince(a.timestamp)}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onDismiss(a.id)}
                className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold opacity-80 hover:bg-black/25 hover:opacity-100"
                aria-label="Dismiss alert"
              >
                ✕
              </button>
            </div>
          </div>
        );
      })}

      <style jsx>{`
        @keyframes flood-toast-in {
          0% { opacity: 0; transform: translateX(24px) scale(0.96); }
          100% { opacity: 1; transform: translateX(0) scale(1); }
        }
        @keyframes flood-pulse {
          0%, 100% { box-shadow: 0 0 24px -4px rgba(220, 38, 38, 0.55); }
          50%      { box-shadow: 0 0 36px -2px rgba(220, 38, 38, 0.85); }
        }
        :global(.animate-flood-pulse) {
          animation: flood-toast-in 280ms cubic-bezier(0.16,1,0.3,1), flood-pulse 1.6s ease-in-out infinite 280ms;
        }
      `}</style>
    </div>
  );
}

// ── Provider ────────────────────────────────────────────────────────────────

export function SensorStreamProvider({ children }: { children: ReactNode }) {
  const subscribers = useRef(new Set<(node: SensorUpdatePayload) => void>());
  const [floodAlerts, setFloodAlerts] = useState<FloodAlertPayload[]>([]);
  const seenIds = useRef(new Set<number>());
  const [desktopAlertsEnabled, setDesktopAlertsEnabled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    setDesktopAlertsEnabled(Notification.permission === "granted");
  }, []);

  const enableDesktopAlerts = useCallback(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "granted") {
      setDesktopAlertsEnabled(true);
      return;
    }
    if (Notification.permission === "denied") return;
    void Notification.requestPermission().then((p) => {
      setDesktopAlertsEnabled(p === "granted");
    });
  }, []);

  const rememberId = (id: number) => {
    const s = seenIds.current;
    if (s.size > 400) s.clear();
    s.add(id);
  };

  const subscribeSensorUpdates = useCallback(
    (cb: (node: SensorUpdatePayload) => void) => {
      subscribers.current.add(cb);
      return () => {
        subscribers.current.delete(cb);
      };
    },
    [],
  );

  const dismissFlood = useCallback((id: number) => {
    setFloodAlerts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const dismissAllFloods = useCallback(() => {
    setFloodAlerts([]);
  }, []);

  useEffect(() => {
    let closed = false;
    let es: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let retryMs = 2000;
    const maxRetryMs = 60_000;

    const onSensor = (e: MessageEvent) => {
      try {
        const node = JSON.parse(e.data as string) as SensorUpdatePayload;
        subscribers.current.forEach((fn) => {
          try {
            fn(node);
          } catch {
            /* subscriber fault — isolate */
          }
        });
      } catch {
        /* ignore malformed */
      }
    };

    const onFlood = (e: MessageEvent) => {
      try {
        const payload = JSON.parse(e.data as string) as FloodAlertPayload;
        if (payload.type !== "flood_alert" || typeof payload.id !== "number") return;
        if (seenIds.current.has(payload.id)) return;
        rememberId(payload.id);
        setFloodAlerts((prev) => {
          const next = [...prev, payload];
          return next.slice(-6);
        });
        playEewChime(payload.severity);
        showDesktopNotification(payload);
      } catch {
        /* ignore */
      }
    };

    const connect = () => {
      if (closed) return;
      es?.close();
      es = new EventSource("/api/sse/sensors");

      es.addEventListener("sensor-update", onSensor);
      es.addEventListener("flood-alert", onFlood);

      es.addEventListener("backend-unavailable", () => {
        es?.close();
        es = null;
        if (closed) return;
        if (reconnectTimer) clearTimeout(reconnectTimer);
        retryMs = maxRetryMs;
        reconnectTimer = setTimeout(connect, retryMs);
      });

      es.onopen = () => {
        retryMs = 2000;
      };

      es.onerror = () => {
        es?.close();
        es = null;
        if (closed) return;
        if (reconnectTimer) clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(connect, retryMs);
        retryMs = Math.min(maxRetryMs, Math.round(retryMs * 1.7));
      };
    };

    connect();

    return () => {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (es) {
        es.removeEventListener("sensor-update", onSensor);
        es.removeEventListener("flood-alert", onFlood);
        es.close();
      }
    };
  }, []);

  const value = useMemo<SensorStreamContextValue>(
    () => ({
      subscribeSensorUpdates,
      enableDesktopAlerts,
      desktopAlertsEnabled,
      activeAlertCount: floodAlerts.length,
    }),
    [subscribeSensorUpdates, enableDesktopAlerts, desktopAlertsEnabled, floodAlerts.length],
  );

  return (
    <SensorStreamContext.Provider value={value}>
      {children}
      <FloodAlertDock
        alerts={floodAlerts}
        onDismiss={dismissFlood}
        onDismissAll={dismissAllFloods}
      />
    </SensorStreamContext.Provider>
  );
}
