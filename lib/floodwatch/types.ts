// FloodWatch IoT API — TypeScript types
//
// Source of truth: http://159.223.70.28/api/v1 (FastAPI service).
// The IoT API is read-only and public; no auth headers required.
//
// Field names mirror the API response shapes verified against the
// FYP-FloodWatch-Docs reference. Keep this file in lockstep with the
// CRM site's copy so the two apps share one schema.

/** Discrete water level reading from a 3-sensor float switch. */
export type WaterLevel = 0 | 1 | 2 | 3;

/**
 * Dataset selector accepted by every endpoint. `real` is production
 * LoRa data, `sample` is the always-on SIM-PITAS simulator (22 nodes
 * across two villages), `all` returns both.
 */
export type Dataset = "real" | "sample" | "all";

/** Alert types emitted by the backend. */
export type AlertType =
  | "flood"
  | "water_fall"
  | "battery_low"
  | "battery_critical"
  | "gps_moved";

/** Online/offline derived from last-seen freshness. */
export type NodeStatus = "online" | "offline";

// ── Resource types ────────────────────────────────────────────────

export type WeatherSnapshot = {
  village_id?: string;
  timestamp?: string;
  temperature_c?: number;
  humidity_pct?: number;
  precipitation_mm?: number;
  rain_mm?: number;
  weather_code?: number;
  cloud_cover_pct?: number;
  wind_speed_kmh?: number;
  wind_gusts_kmh?: number;
  is_day?: boolean;
};

export type WeatherForecastHour = {
  hour: string;
  precip_prob_pct?: number;
};

export type VillageTopology = {
  master: string;
  node_count: number;
  chains: { id: string; nodes: string[] }[];
};

export type IoTVillage = {
  village_id: string;
  /** Optional in the wild — real-data villages may have no display name yet. */
  name?: string;
  lat?: number | null;
  lng?: number | null;
  district?: string;
  state?: string;
  total_nodes: number;
  nodes_online: number;
  nodes_offline?: number;
  /** ID of the LoRa master gateway bridging this village to the cloud. */
  master_id?: string;
  status?: NodeStatus;
  total_alerts?: number;
  alerts_by_type?: Partial<Record<AlertType | "battery", number>>;
  first_seen?: string;
  last_seen?: string;
  weather?: WeatherSnapshot;
  /** Only present on the village-detail endpoint. */
  weather_forecast?: WeatherForecastHour[];
  /** Only present on the village-detail endpoint. */
  topology?: VillageTopology;
};

export type IoTNode = {
  node_id: string;
  village_id: string;
  parent_id?: string;
  depth?: number;
  status: NodeStatus;
  water_level: WaterLevel;
  /** Raw float-switch bitmask: bit0 = low, bit1 = mid, bit2 = high. */
  float_bits: number;
  battery_voltage: number;
  gps_fix: boolean;
  lat?: number | null;
  lng?: number | null;
  install_lat?: number | null;
  install_lng?: number | null;
  rssi?: number;
  snr?: number;
  last_seen: string;
  first_seen?: string;
  /** Per-type alert counters maintained by the IoT API. */
  alert_counts?: Partial<Record<AlertType, number>>;
  /** Most-recent alert document id, if any. */
  last_alert_id?: string;
  /** Flag set when the document originates from the SIM-PITAS simulator. */
  is_sample?: boolean;
};

export type IoTReading = {
  timestamp: string;
  water_level: WaterLevel;
  float_bits: number;
  battery_voltage: number;
  gps_fix: boolean;
  lat?: number | null;
  lng?: number | null;
  rssi?: number;
  snr?: number;
};

export type IoTReadingsPage = {
  node_id: string;
  page: number;
  page_size: number;
  data: IoTReading[];
};

export type IoTAlert = {
  node_id: string;
  village_id: string;
  alert_type: AlertType;
  timestamp: string;
  /** Set only for flood alerts. */
  level?: WaterLevel;
  /** Sometimes mirrored from `level`. */
  water_level?: WaterLevel;
  float_bits?: number;
  battery_voltage?: number;
  gps_fix: boolean;
  lat?: number | null;
  lng?: number | null;
  /** Metres from install position — gps_moved alerts only. */
  dist_m?: number;
  home_lat?: number;
  home_lng?: number;
  rssi?: number;
  snr?: number;
  weather_at_alert?: WeatherSnapshot;
};

export type IoTAlertsPage = {
  page: number;
  page_size: number;
  data: IoTAlert[];
};

export type IoTMaster = {
  node_id: string;
  village_id: string;
  status: NodeStatus;
  last_seen: string;
};

export type IoTStats = {
  total_villages: number;
  total_river_nodes: number;
  total_master_nodes: number;
  nodes_online: number;
  nodes_offline: number;
  total_alerts: number;
  total_messages_received: number;
  alerts_by_type: Partial<Record<AlertType, number>>;
  last_updated: string;
};

export type IoTNodeSummary = {
  node_id: string;
  period: string;
  from: string;
  to: string;
  dataset: Dataset;
  reading_count: number;
  avg_water_level: number;
  min_water_level: number;
  max_water_level: number;
  avg_battery_v: number;
  min_battery_v: number;
  first_reading: string;
  last_reading: string;
  total_alerts: number;
  alerts_by_type: Partial<Record<AlertType, number>>;
};

export type IoTVillageSummary = {
  village_id: string;
  period: string;
  dataset: Dataset;
  total_readings: number;
  total_alerts: number;
  alerts_by_type: Partial<Record<AlertType, number>>;
  nodes: Array<{
    node_id: string;
    reading_count: number;
    avg_water_level: number;
    min_water_level: number;
    max_water_level: number;
    avg_battery_v: number;
    min_battery_v: number;
  }>;
};

export type IoTStatsSummary = {
  period: string;
  from: string;
  to: string;
  dataset: Dataset;
  peak_water_level: WaterLevel;
  total_readings: number;
  total_alerts: number;
  alerts_by_type: Partial<Record<AlertType, number>>;
  top_active_nodes: Array<{ node_id: string; readings: number }>;
  top_alerted_villages: Array<{ village_id: string; alerts: number }>;
};

export type IoTHistoryEvent = {
  event_type:
    | "node_online"
    | "node_offline"
    | "master_online"
    | "master_offline"
    | "announce";
  node_id: string;
  village_id: string;
  timestamp: string;
  data?: Record<string, unknown>;
};

export type IoTEventsHistoryPage = {
  page: number;
  page_size: number;
  data: IoTHistoryEvent[];
};

// ── SSE event payloads ────────────────────────────────────────────
//
// The /api/v1/events/stream endpoint multiplexes typed events. Each
// event carries `type` plus event-specific fields. The discriminated
// union below maps to what the parser publishes.

export type StreamHeartbeat = {
  type: "heartbeat";
  node_id: string;
  village_id: string;
  water_level: WaterLevel;
  float_bits: number;
  bat: number;
  gps_fix: boolean;
  lat?: number | null;
  lng?: number | null;
  depth?: number;
  parent?: string;
  rssi?: number;
  snr?: number;
  timestamp: string;
};

export type StreamFloodLevel = {
  type: "flood_level";
  node_id: string;
  village_id: string;
  water_level: WaterLevel;
  water_level_prev: WaterLevel | null;
  float_bits: number;
  gps_fix: boolean;
  lat?: number | null;
  lng?: number | null;
  timestamp: string;
};

export type StreamAlert = {
  type: "alert";
  node_id: string;
  village_id: string;
  alert_type: AlertType;
  level?: WaterLevel;
  float_bits?: number;
  bat?: number;
  gps_fix: boolean;
  lat?: number | null;
  lng?: number | null;
  dist_m?: number;
  home_lat?: number;
  home_lng?: number;
  rssi?: number;
  timestamp: string;
};

export type StreamNodeStatus = {
  type: "node_online" | "node_offline";
  node_id: string;
  village_id: string;
  timestamp: string;
};

export type StreamWeatherUpdate = {
  type: "weather_update";
  village_id: string;
  temperature_c?: number;
  humidity_pct?: number;
  precipitation_mm?: number;
  rain_mm?: number;
  weather_code?: number;
  cloud_cover_pct?: number;
  wind_speed_kmh?: number;
  wind_gusts_kmh?: number;
  is_day?: boolean;
  timestamp: string;
};

export type StreamNodeAnnounce = {
  type: "node_announce";
  node_id: string;
  village_id: string;
  depth?: number;
  parent?: string;
  lat?: number | null;
  lng?: number | null;
  timestamp: string;
};

export type IoTStreamEvent =
  | StreamHeartbeat
  | StreamFloodLevel
  | StreamAlert
  | StreamNodeStatus
  | StreamWeatherUpdate
  | StreamNodeAnnounce;

/** Event names recognised by the upstream SSE multiplexer. */
export type IoTStreamEventName = IoTStreamEvent["type"];

/** Severity buckets the UI uses to pick toast colour, push priority, etc. */
export type AlertSeverity = "watch" | "warning" | "critical";

/** Helper for downstream consumers: map a flood alert level to a severity. */
export function severityForLevel(level: WaterLevel | undefined): AlertSeverity {
  if (level === 3) return "critical";
  if (level === 2) return "warning";
  return "watch";
}
