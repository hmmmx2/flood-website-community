"use client";

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
};

const SensorStreamContext = createContext<SensorStreamContextValue | null>(null);

export function useSensorStream(): SensorStreamContextValue {
  const ctx = useContext(SensorStreamContext);
  if (!ctx) {
    throw new Error("useSensorStream must be used within SensorStreamProvider");
  }
  return ctx;
}

function severityStyles(sev: FloodAlertPayload["severity"]): string {
  switch (sev) {
    case "CRITICAL":
      return "bg-[#450a0a] border-red-900 text-white shadow-red-900/40";
    case "WARNING":
      return "bg-red-700 border-red-800 text-white shadow-red-900/30";
    default:
      return "bg-amber-600 border-amber-700 text-white shadow-amber-900/25";
  }
}

function FloodAlertDock({
  alerts,
  onDismiss,
}: {
  alerts: FloodAlertPayload[];
  onDismiss: (id: number) => void;
}) {
  if (alerts.length === 0) return null;

  return (
    <div
      className="fixed top-4 right-4 z-[200] flex max-h-[85vh] w-[min(100vw-2rem,22rem)] flex-col gap-2 overflow-y-auto pointer-events-none"
      aria-live="assertive"
      aria-relevant="additions"
    >
      {alerts.map((a) => (
        <div
          key={`${a.id}-${a.timestamp ?? ""}`}
          role="alert"
          className={`pointer-events-auto animate-in slide-in-from-right-4 fade-in duration-300 rounded-xl border-2 px-4 py-3 shadow-lg backdrop-blur-sm ${severityStyles(a.severity)}`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-90">
                Flood advisory · {a.severity}
              </p>
              <p className="mt-1 text-sm font-semibold leading-snug">
                Sensor alert — {a.nodeName || a.nodeId}
              </p>
              <p className="mt-1 text-xs opacity-90">
                Water level {a.waterLevelFeet.toFixed(1)} ft · Zone {a.zone ?? "—"}
              </p>
              <Link
                href="/flood-map"
                className="mt-2 inline-block text-xs font-bold underline underline-offset-2 hover:opacity-90"
              >
                View live sensors →
              </Link>
            </div>
            <button
              type="button"
              onClick={() => onDismiss(a.id)}
              className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold opacity-80 hover:bg-black/20 hover:opacity-100"
              aria-label="Dismiss alert"
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export function SensorStreamProvider({ children }: { children: ReactNode }) {
  const subscribers = useRef(new Set<(node: SensorUpdatePayload) => void>());
  const [floodAlerts, setFloodAlerts] = useState<FloodAlertPayload[]>([]);
  const seenIds = useRef(new Set<number>());

  const rememberId = (id: number) => {
    const s = seenIds.current;
    if (s.size > 400) s.clear();
    s.add(id);
  };

  const subscribeSensorUpdates = useCallback((cb: (node: SensorUpdatePayload) => void) => {
    subscribers.current.add(cb);
    return () => {
      subscribers.current.delete(cb);
    };
  }, []);

  const dismissFlood = useCallback((id: number) => {
    setFloodAlerts((prev) => prev.filter((a) => a.id !== id));
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

      // Backend-unavailable event: upstream unreachable (e.g. JAVA_API_URL not set in Vercel).
      // Back off with a long delay instead of hammering every 2 s.
      es.addEventListener("backend-unavailable", () => {
        es?.close();
        es = null;
        if (closed) return;
        if (reconnectTimer) clearTimeout(reconnectTimer);
        // Long retry when the Java backend is known-unavailable (60 s)
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
        /* Default EventSource reconnect hammers a failing BFF (e.g. 502) — back off. */
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

  const value = useMemo(() => ({ subscribeSensorUpdates }), [subscribeSensorUpdates]);

  return (
    <SensorStreamContext.Provider value={value}>
      {children}
      <FloodAlertDock alerts={floodAlerts} onDismiss={dismissFlood} />
    </SensorStreamContext.Provider>
  );
}
