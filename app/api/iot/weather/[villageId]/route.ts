// GET /api/iot/weather/{villageId}?from=&to=&page=&page_size=&dataset=...
// Paginated weather history (Open-Meteo origin, 30-min polling).

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
  const params = {
    from: sp.get("from") ?? undefined,
    to: sp.get("to") ?? undefined,
    page: sp.get("page") ?? undefined,
    page_size: sp.get("page_size") ?? undefined,
    dataset: (sp.get("dataset") ?? undefined) as Dataset | undefined,
  };
  try {
    const history = await floodwatchFetch<WeatherSnapshot[]>(
      `/weather/${encodeURIComponent(villageId)}`,
      { params },
    );
    return NextResponse.json(history);
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
