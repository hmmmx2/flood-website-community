// GET /api/iot/stats/summary?period=today|week|month&dataset=...
// Proxies the FloodWatch IoT aggregate (peak level, top active nodes,
// top alerted villages). Drives dashboard KPIs.

import { NextRequest, NextResponse } from "next/server";

import {
  FloodwatchFetchError,
  floodwatchFetch,
} from "@/lib/floodwatch/api";
import type { Dataset, IoTStatsSummary } from "@/lib/floodwatch/types";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const period = sp.get("period") ?? undefined;
  const from = sp.get("from") ?? undefined;
  const to = sp.get("to") ?? undefined;
  const dataset = (sp.get("dataset") ?? undefined) as Dataset | undefined;

  try {
    const summary = await floodwatchFetch<IoTStatsSummary>("/stats/summary", {
      params: { period, from, to, dataset },
    });
    return NextResponse.json(summary);
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
