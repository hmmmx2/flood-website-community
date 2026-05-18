// GET /api/iot/stats
// Proxies the FloodWatch IoT API's system-wide KPI summary. Public, no
// auth — the upstream data is public flood-monitoring telemetry.

import { NextRequest, NextResponse } from "next/server";

import {
  FloodwatchFetchError,
  floodwatchFetch,
} from "@/lib/floodwatch/api";
import type { Dataset, IoTStats } from "@/lib/floodwatch/types";

export async function GET(req: NextRequest) {
  const dataset = req.nextUrl.searchParams.get("dataset") as Dataset | null;
  try {
    const stats = await floodwatchFetch<IoTStats>("/stats", {
      params: dataset ? { dataset } : undefined,
    });
    return NextResponse.json(stats);
  } catch (err) {
    if (err instanceof FloodwatchFetchError) {
      return NextResponse.json(
        { error: err.message, status: err.status },
        { status: err.status || 502 },
      );
    }
    return NextResponse.json(
      { error: "FloodWatch IoT API unreachable" },
      { status: 502 },
    );
  }
}
