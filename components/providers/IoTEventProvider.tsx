"use client";

/**
 * IoTEventProvider — live FloodWatch IoT data for the community site.
 *
 * Subscribes to /api/sse/iot-events (which proxies the FastAPI service
 * at FLOODWATCH_API_BASE) and fans events out to the rest of the app:
 *
 *   1. `useIoTStream()` exposes derived state — alerts, per-node flood
 *      levels, per-node online/offline status, per-village weather, and
 *      a connection-status field that pages can render.
 *   2. The provider renders <IoTFloodAlertDock /> — a top-right toast
 *      stack identical in spirit to the legacy FloodAlertDock but
 *      shaped for the IoT alert payload (0–3 ordinal water level,
 *      `alert_type` discriminant, village id).
 *   3. Audio chime + browser Notification API fire on critical/warning
 *      alerts when the tab is backgrounded — mirroring the EEW pattern
 *      used by the legacy provider.
 *
 * This is now the single live-data provider for the community site —
 * the legacy SensorStreamProvider (which spoke to the Java backend's
 * mock sensor SSE) was retired when the IoT API became the source of
 * truth. The orphaned provider + `/api/sse/sensors` route remain on
 * disk pending a separate cleanup ticket.
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
import { useSearchParams } from "next/navigation";

import type {
  AlertSeverity,
  IoTAlert,
  IoTStreamEvent,
  StreamAlert,
  StreamFloodLevel,
  StreamHeartbeat,
  StreamNodeStatus,
  StreamWeatherUpdate,
  WaterLevel,
  WeatherSnapshot,
  NodeStatus,
} from "@/lib/floodwatch/types";
import { severityForLevel } from "@/lib/floodwatch/types";

// ── Public context surface ────────────────────────────────────────

type IoTStreamContextValue = {
  /** Connection state of the underlying SSE pipe. */
  status: "connecting" | "open" | "error" | "offline";
  /** Newest-first list of recently observed alerts (max 50). */
  alerts: IoTAlert[];
  /** Live water level keyed by node_id (most recent flood_level event). */
  floodLevels: Map<string, WaterLevel>;
  /** Online/offline per node, from `node_online` and `node_offline`. */
  nodeStatus: Map<string, NodeStatus>;
  /** Most recent weather snapshot keyed by village_id. */
  weather: Map<string, WeatherSnapshot>;
  /** Heartbeat seq per node — pages can re-render when a node pings. */
  heartbeatSeq: Map<string, number>;
  /** Subscribe to every event for ad-hoc map / chart updates. */
  subscribe: (cb: (event: IoTStreamEvent) => void) => () => void;
  /** Trigger the browser Notification permission prompt. */
  enableDesktopAlerts: () => void;
  desktopAlertsEnabled: boolean;
};

const IoTStreamContext = createContext<IoTStreamContextValue | null>(null);

export function useIoTStream(): IoTStreamContextValue {
  const ctx = useContext(IoTStreamContext);
  if (!ctx) {
    throw new Error("useIoTStream must be used within IoTEventProvider");
  }
  return ctx;
}

// ── Severity → palette (lifted from the FloodAlertDock so the two
//    docks look identical to residents) ─────────────────────────────

function severityTone(sev: AlertSeverity) {
  switch (sev) {
    case "critical":
      return {
        bar: "bg-[#dc2626]",
        accent: "#dc2626",
        copy: "text-white",
        surface: "linear-gradient(135deg, #450a0a, #7f1d1d 70%, #b91c1c)",
        glow: "shadow-[0_0_24px_-4px_rgba(220,38,38,0.55)]",
        pulse: true,
      };
    case "warning":
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

function severityLabel(sev: AlertSeverity): string {
  if (sev === "critical") return "Critical";
  if (sev === "warning") return "Warning";
  return "Watch";
}

function timeSince(iso: string | null | undefined): string {
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

function alertTitle(alert: IoTAlert): string {
  switch (alert.alert_type) {
    case "flood":
      return "Flood alert";
    case "water_fall":
      return "Water level dropped";
    case "battery_low":
      return "Sensor battery low";
    case "battery_critical":
      return "Sensor battery critical";
    case "gps_moved":
      return "Sensor moved";
    default:
      return "Sensor alert";
  }
}

function alertBody(alert: IoTAlert): string {
  if (alert.alert_type === "flood" || alert.alert_type === "water_fall") {
    const level = alert.level ?? alert.water_level ?? 0;
    return `Water level ${level}/3 at sensor ${alert.node_id}`;
  }
  if (alert.alert_type === "battery_critical" || alert.alert_type === "battery_low") {
    const v = alert.battery_voltage?.toFixed(2) ?? "?";
    return `Battery ${v}V at sensor ${alert.node_id}`;
  }
  if (alert.alert_type === "gps_moved") {
    const d = alert.dist_m ? `${Math.round(alert.dist_m)} m` : "moved";
    return `Sensor ${alert.node_id} ${d} from install`;
  }
  return `Sensor ${alert.node_id} reported an event`;
}

/** Severity bucket the dock uses to colour and prioritise an alert. */
function alertSeverity(alert: IoTAlert): AlertSeverity {
  if (alert.alert_type === "flood") {
    return severityForLevel(alert.level ?? alert.water_level);
  }
  if (alert.alert_type === "battery_critical") return "warning";
  if (alert.alert_type === "battery_low") return "watch";
  if (alert.alert_type === "gps_moved") return "watch";
  if (alert.alert_type === "water_fall") return "watch";
  return "watch";
}

/**
 * Stable identity for a single alert event. The IoT API can emit
 * multiple alert types from the same reading at the same exact
 * timestamp (e.g. a level transition firing both `flood` and
 * `water_fall`), so we MUST include `alert_type` — `node_id-timestamp`
 * alone collides and trips React's duplicate-key warning.
 */
function alertKey(alert: IoTAlert): string {
  return `${alert.node_id}-${alert.alert_type ?? "alert"}-${alert.timestamp}`;
}

// ── Audio chime + Notification helpers (shared with legacy dock) ──

function playEewChime(severity: AlertSeverity) {
  if (typeof window === "undefined") return;
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
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
    beep(880, 0, 0.18, 0.18);
    beep(660, 0.22, 0.22, 0.18);
    if (severity === "critical") beep(990, 0.5, 0.28, 0.22);
    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 1500);
  } catch {
    /* audio is best-effort */
  }
}

function showDesktopNotification(alert: IoTAlert) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  if (typeof document !== "undefined" && document.visibilityState === "visible") return;
  try {
    const sev = alertSeverity(alert);
    const n = new Notification(
      `${alertTitle(alert)} — ${severityLabel(sev)}`,
      {
        body: alertBody(alert),
        tag: `iot-alert-${alertKey(alert)}`,
        requireInteraction: sev === "critical",
        silent: false,
      },
    );
    n.onclick = () => {
      window.focus();
      window.location.href = `/flood-map?focus=${encodeURIComponent(alert.node_id)}`;
      n.close();
    };
  } catch {
    /* permission revoked between check and call — ignore */
  }
}

// ── The dock itself ───────────────────────────────────────────────

/**
 * How long each visible toast stays before auto-dismissing itself.
 * Calibrated for the EEW idiom: critical sticks around long enough that a
 * commuter glancing at their phone notices it; watch-tier evaporates
 * quickly so the sample-data firehose doesn't bury the map.
 *
 * Hovering a toast freezes its timer (paused state) so users can actually
 * read what's there without it disappearing under their cursor.
 */
const AUTO_DISMISS_MS: Record<AlertSeverity, number> = {
  critical: 60_000,
  warning: 30_000,
  watch: 12_000,
};

/** Maximum toasts the dock renders in collapsed mode. Older ones queue
 *  behind a "+N more" pill that, when clicked, expands the list. */
const DOCK_VISIBLE_CAP = 5;

function IoTFloodAlertDock({
  alerts,
  onDismiss,
  onDismissAll,
}: {
  alerts: IoTAlert[];
  onDismiss: (key: string) => void;
  onDismissAll: () => void;
}) {
  // Keep relative timestamps live without re-running the SSE effect.
  const [, force] = useState(0);
  const [expanded, setExpanded] = useState(false);
  /** Toast keys the user is currently hovering — their timers stay paused. */
  const [hovered, setHovered] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (alerts.length === 0) return;
    const t = window.setInterval(() => force((n) => n + 1), 30_000);
    return () => window.clearInterval(t);
  }, [alerts.length]);

  // Auto-dismiss each toast on a severity-keyed timer. Hovered toasts
  // skip this pass; when the cursor leaves, the effect re-runs and
  // schedules a fresh full-duration timer. That's a deliberate UX
  // choice — the timer should restart, not pick up mid-flight, after a
  // user reads a toast.
  useEffect(() => {
    if (alerts.length === 0) return;
    const timers: number[] = [];
    for (const a of alerts) {
      const key = alertKey(a);
      if (hovered.has(key)) continue;
      const sev = alertSeverity(a);
      const ttl = AUTO_DISMISS_MS[sev];
      const elapsed = Date.now() - new Date(a.timestamp).getTime();
      const remaining = Math.max(0, ttl - elapsed);
      timers.push(window.setTimeout(() => onDismiss(key), remaining));
    }
    return () => {
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [alerts, hovered, onDismiss]);

  if (alerts.length === 0) return null;

  const highestSeverity: AlertSeverity = alerts.some(
    (a) => alertSeverity(a) === "critical",
  )
    ? "critical"
    : alerts.some((a) => alertSeverity(a) === "warning")
      ? "warning"
      : "watch";

  const headerTone = severityTone(highestSeverity);
  const visible = expanded ? alerts : alerts.slice(0, DOCK_VISIBLE_CAP);
  const hiddenCount = Math.max(0, alerts.length - DOCK_VISIBLE_CAP);

  return (
    <div
      className="fixed top-20 right-4 z-[200] flex max-h-[85vh] w-[min(100vw-2rem,22rem)] flex-col gap-2 overflow-y-auto pointer-events-none"
      aria-live="assertive"
      aria-relevant="additions"
    >
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

      {visible.map((a) => {
        const sev = alertSeverity(a);
        const tone = severityTone(sev);
        // The IoT API can emit multiple alert types for one node at one
        // instant (e.g. `flood` + `water_fall` on the same reading), so
        // the React key must include `alert_type` — `node_id-timestamp`
        // alone collides and triggers React's duplicate-key warning.
        const key = alertKey(a);
        return (
          <div
            key={key}
            role="alert"
            className={`pointer-events-auto relative overflow-hidden rounded-xl border-2 ${tone.copy} ${tone.glow} ${tone.pulse ? "animate-iot-flood-pulse" : ""}`}
            style={{
              background: tone.surface,
              borderColor: tone.accent,
              animation: "iot-toast-in 280ms cubic-bezier(0.16,1,0.3,1)",
            }}
            onMouseEnter={() =>
              setHovered((h) => {
                if (h.has(key)) return h;
                const next = new Set(h);
                next.add(key);
                return next;
              })
            }
            onMouseLeave={() =>
              setHovered((h) => {
                if (!h.has(key)) return h;
                const next = new Set(h);
                next.delete(key);
                return next;
              })
            }
          >
            <div className={`absolute left-0 top-0 h-full w-1 ${tone.bar}`} aria-hidden />
            <div className="flex items-start justify-between gap-2 px-4 py-3 pl-5">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-95">
                  {alertTitle(a)} · {severityLabel(sev)}
                </p>
                <p className="mt-1 text-sm font-semibold leading-snug">
                  {a.village_id ? `${a.village_id} · ` : ""}
                  {a.node_id}
                </p>
                <p className="mt-0.5 text-xs opacity-95">{alertBody(a)}</p>
                <div className="mt-2 flex items-center justify-between gap-2 text-[11px] opacity-90">
                  <Link
                    href={`/flood-map?focus=${encodeURIComponent(a.node_id)}`}
                    className="font-bold underline underline-offset-2 hover:opacity-100"
                  >
                    View live sensor →
                  </Link>
                  <span className="tabular-nums">{timeSince(a.timestamp)}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onDismiss(key)}
                className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold opacity-80 hover:bg-black/25 hover:opacity-100"
                aria-label="Dismiss alert"
              >
                ✕
              </button>
            </div>
          </div>
        );
      })}

      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="pointer-events-auto self-end rounded-full border border-white/20 bg-slate-900/85 px-3 py-1 text-[11px] font-semibold text-white/90 shadow backdrop-blur-md transition hover:bg-slate-800/90"
        >
          {expanded ? "Show fewer" : `+${hiddenCount} more alert${hiddenCount === 1 ? "" : "s"}`}
        </button>
      )}

      <style jsx>{`
        @keyframes iot-toast-in {
          0% { opacity: 0; transform: translateX(24px) scale(0.96); }
          100% { opacity: 1; transform: translateX(0) scale(1); }
        }
        @keyframes iot-flood-pulse {
          0%, 100% { box-shadow: 0 0 24px -4px rgba(220, 38, 38, 0.55); }
          50%      { box-shadow: 0 0 36px -2px rgba(220, 38, 38, 0.85); }
        }
        :global(.animate-iot-flood-pulse) {
          animation: iot-toast-in 280ms cubic-bezier(0.16,1,0.3,1), iot-flood-pulse 1.6s ease-in-out infinite 280ms;
        }
      `}</style>
    </div>
  );
}

// ── Provider ──────────────────────────────────────────────────────

/** Cap the number of alerts retained for the dock + history. */
const MAX_RETAINED_ALERTS = 50;
/** Dedupe alerts arriving within this many ms of each other for the same node. */
const ALERT_DEDUPE_WINDOW_MS = 1000;

export function IoTEventProvider({ children }: { children: ReactNode }) {
  // Pick up `?dataset=sample|all` from the URL so the SSE stream pulls
  // the same dataset the page is rendering. Without this, navigating to
  // /flood-map?dataset=sample shows the sample-data zones (via the BFF)
  // but listens to production live events — the two never line up.
  // useSearchParams is reactive: changing the query string in-flight
  // reconnects the EventSource via the effect dep below.
  const searchParams = useSearchParams();
  const datasetParam = searchParams?.get("dataset");
  const dataset =
    datasetParam === "sample" || datasetParam === "all"
      ? datasetParam
      : null;

  const subscribers = useRef(new Set<(event: IoTStreamEvent) => void>());
  const [alerts, setAlerts] = useState<IoTAlert[]>([]);
  const [floodLevels, setFloodLevels] = useState<Map<string, WaterLevel>>(new Map());
  const [nodeStatusMap, setNodeStatusMap] = useState<Map<string, NodeStatus>>(new Map());
  const [weatherMap, setWeatherMap] = useState<Map<string, WeatherSnapshot>>(new Map());
  const [heartbeatSeq, setHeartbeatSeq] = useState<Map<string, number>>(new Map());
  const [status, setStatus] = useState<IoTStreamContextValue["status"]>("connecting");
  const [desktopAlertsEnabled, setDesktopAlertsEnabled] = useState(false);
  /** Tracks last-seen alert keys for dedupe — `{node}|{type}`. */
  const lastAlertKey = useRef<Map<string, number>>(new Map());
  /** Dismissed alert keys so they don't re-appear after re-render. */
  const dismissedKeys = useRef<Set<string>>(new Set());

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

  const subscribe = useCallback(
    (cb: (event: IoTStreamEvent) => void) => {
      subscribers.current.add(cb);
      return () => {
        subscribers.current.delete(cb);
      };
    },
    [],
  );

  const dismissAlert = useCallback((key: string) => {
    dismissedKeys.current.add(key);
    setAlerts((prev) => prev.filter((a) => alertKey(a) !== key));
  }, []);

  const dismissAll = useCallback(() => {
    setAlerts((prev) => {
      prev.forEach((a) => dismissedKeys.current.add(alertKey(a)));
      return [];
    });
  }, []);

  // ── SSE connection effect ────────────────────────────────────────
  useEffect(() => {
    let closed = false;
    let es: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let retryMs = 2000;
    const maxRetryMs = 60_000;

    const dispatch = (event: IoTStreamEvent) => {
      subscribers.current.forEach((fn) => {
        try {
          fn(event);
        } catch {
          /* subscriber fault — isolate */
        }
      });
    };

    const handlers: { [K in IoTStreamEvent["type"]]: (data: unknown) => void } = {
      heartbeat: (data) => {
        const ev = data as StreamHeartbeat;
        if (!ev?.node_id) return;
        dispatch(ev);
        setHeartbeatSeq((prev) => {
          const next = new Map(prev);
          next.set(ev.node_id, (next.get(ev.node_id) ?? 0) + 1);
          return next;
        });
        setNodeStatusMap((prev) => {
          if (prev.get(ev.node_id) === "online") return prev;
          const next = new Map(prev);
          next.set(ev.node_id, "online");
          return next;
        });
      },
      flood_level: (data) => {
        const ev = data as StreamFloodLevel;
        if (!ev?.node_id) return;
        dispatch(ev);
        setFloodLevels((prev) => {
          const next = new Map(prev);
          next.set(ev.node_id, ev.water_level);
          return next;
        });
      },
      alert: (data) => {
        const ev = data as StreamAlert;
        if (!ev?.node_id) return;
        dispatch(ev);
        const dedupeKey = `${ev.node_id}|${ev.alert_type}`;
        const lastSeen = lastAlertKey.current.get(dedupeKey) ?? 0;
        if (Date.now() - lastSeen < ALERT_DEDUPE_WINDOW_MS) return;
        lastAlertKey.current.set(dedupeKey, Date.now());

        const alert: IoTAlert = {
          node_id: ev.node_id,
          village_id: ev.village_id,
          alert_type: ev.alert_type,
          timestamp: ev.timestamp,
          level: ev.level,
          water_level: ev.level,
          float_bits: ev.float_bits,
          battery_voltage: ev.bat,
          gps_fix: ev.gps_fix,
          lat: ev.lat ?? null,
          lng: ev.lng ?? null,
          dist_m: ev.dist_m,
          home_lat: ev.home_lat,
          home_lng: ev.home_lng,
          rssi: ev.rssi,
        };
        const thisAlertKey = alertKey(alert);
        if (dismissedKeys.current.has(thisAlertKey)) return;

        setAlerts((prev) => {
          const next = [alert, ...prev].slice(0, MAX_RETAINED_ALERTS);
          return next;
        });

        const sev = alertSeverity(alert);
        // Only chime / notify for the meaningful tiers.
        if (sev !== "watch") {
          playEewChime(sev);
          showDesktopNotification(alert);
        }
      },
      node_online: (data) => {
        const ev = data as StreamNodeStatus;
        if (!ev?.node_id) return;
        dispatch(ev);
        setNodeStatusMap((prev) => {
          const next = new Map(prev);
          next.set(ev.node_id, "online");
          return next;
        });
      },
      node_offline: (data) => {
        const ev = data as StreamNodeStatus;
        if (!ev?.node_id) return;
        dispatch(ev);
        setNodeStatusMap((prev) => {
          const next = new Map(prev);
          next.set(ev.node_id, "offline");
          return next;
        });
      },
      weather_update: (data) => {
        const ev = data as StreamWeatherUpdate;
        if (!ev?.village_id) return;
        dispatch(ev);
        setWeatherMap((prev) => {
          const next = new Map(prev);
          next.set(ev.village_id, {
            village_id: ev.village_id,
            timestamp: ev.timestamp,
            temperature_c: ev.temperature_c,
            humidity_pct: ev.humidity_pct,
            precipitation_mm: ev.precipitation_mm,
            rain_mm: ev.rain_mm,
            weather_code: ev.weather_code,
            cloud_cover_pct: ev.cloud_cover_pct,
            wind_speed_kmh: ev.wind_speed_kmh,
            wind_gusts_kmh: ev.wind_gusts_kmh,
            is_day: ev.is_day,
          });
          return next;
        });
      },
      node_announce: (data) => {
        // Sanitised away upstream — included here only so the TypeScript
        // mapping is exhaustive.
        dispatch(data as IoTStreamEvent);
      },
    };

    const makeEventListener = (type: IoTStreamEvent["type"]) =>
      (e: MessageEvent) => {
        try {
          const parsed = JSON.parse(e.data as string);
          handlers[type](parsed);
        } catch {
          /* ignore malformed */
        }
      };

    const connect = () => {
      if (closed) return;
      setStatus("connecting");
      es?.close();
      const url = dataset
        ? `/api/sse/iot-events?dataset=${encodeURIComponent(dataset)}`
        : "/api/sse/iot-events";
      es = new EventSource(url);

      // Attach every event handler we care about.
      const listeners: Array<[IoTStreamEvent["type"], (e: MessageEvent) => void]> = [
        ["heartbeat", makeEventListener("heartbeat")],
        ["flood_level", makeEventListener("flood_level")],
        ["alert", makeEventListener("alert")],
        ["node_online", makeEventListener("node_online")],
        ["node_offline", makeEventListener("node_offline")],
        ["weather_update", makeEventListener("weather_update")],
      ];
      listeners.forEach(([type, fn]) => es!.addEventListener(type, fn));

      es.addEventListener("backend-unavailable", () => {
        es?.close();
        es = null;
        if (closed) return;
        setStatus("offline");
        if (reconnectTimer) clearTimeout(reconnectTimer);
        retryMs = maxRetryMs;
        reconnectTimer = setTimeout(connect, retryMs);
      });

      es.onopen = () => {
        setStatus("open");
        retryMs = 2000;
      };

      es.onerror = () => {
        es?.close();
        es = null;
        if (closed) return;
        setStatus("error");
        if (reconnectTimer) clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(connect, retryMs);
        retryMs = Math.min(maxRetryMs, Math.round(retryMs * 1.7));
      };
    };

    connect();

    return () => {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      es?.close();
    };
    // dataset is intentionally in the dep list: when the URL flips
    // between real and sample, we tear down the old EventSource and
    // open a new one against the right upstream.
  }, [dataset]);

  const value = useMemo<IoTStreamContextValue>(
    () => ({
      status,
      alerts,
      floodLevels,
      nodeStatus: nodeStatusMap,
      weather: weatherMap,
      heartbeatSeq,
      subscribe,
      enableDesktopAlerts,
      desktopAlertsEnabled,
    }),
    [
      status,
      alerts,
      floodLevels,
      nodeStatusMap,
      weatherMap,
      heartbeatSeq,
      subscribe,
      enableDesktopAlerts,
      desktopAlertsEnabled,
    ],
  );

  return (
    <IoTStreamContext.Provider value={value}>
      {children}
      <IoTFloodAlertDock
        alerts={alerts}
        onDismiss={dismissAlert}
        onDismissAll={dismissAll}
      />
    </IoTStreamContext.Provider>
  );
}
