// GET /api/iot/villages/{id}
// Returns the full village document (topology + 24h forecast).

import { NextRequest, NextResponse } from "next/server";

import {
  FloodwatchFetchError,
  floodwatchFetch,
} from "@/lib/floodwatch/api";
import type { Dataset, IoTVillage } from "@/lib/floodwatch/types";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const dataset = (req.nextUrl.searchParams.get("dataset") ?? undefined) as
    | Dataset
    | undefined;
  try {
    const village = await floodwatchFetch<IoTVillage>(
      `/villages/${encodeURIComponent(id)}`,
      { params: { dataset } },
    );
    return NextResponse.json(village);
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
