// GET /api/iot/weather/{villageId}/at?t=ISO8601&dataset=...
// Last-known weather snapshot at or before a given timestamp. Useful for
// correlating historical alerts with weather.

import { NextRequest, NextResponse } from "next/server";

import {
  FloodwatchFetchError,
  floodwatchFetch,
} from "@/lib/floodwatch/api";
import type { Dataset, WeatherSnapshot } from "@/lib/floodwatch/types";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ villageId: string }> },
) {
  const { villageId } = await ctx.params;
  const sp = req.nextUrl.searchParams;
  const t = sp.get("t");
  if (!t) {
    return NextResponse.json(
      { error: "Missing required query param: t (ISO 8601)" },
      { status: 400 },
    );
  }
  const dataset = (sp.get("dataset") ?? undefined) as Dataset | undefined;
  try {
    const snap = await floodwatchFetch<WeatherSnapshot>(
      `/weather/${encodeURIComponent(villageId)}/at`,
      { params: { t, dataset } },
    );
    return NextResponse.json(snap);
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
