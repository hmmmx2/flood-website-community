// GET /api/iot/villages?dataset=...
// Returns the list of villages with their current weather snapshot.

import { NextRequest, NextResponse } from "next/server";

import {
  FloodwatchFetchError,
  floodwatchFetch,
} from "@/lib/floodwatch/api";
import type { Dataset, IoTVillage } from "@/lib/floodwatch/types";

export async function GET(req: NextRequest) {
  const dataset = (req.nextUrl.searchParams.get("dataset") ?? undefined) as
    | Dataset
    | undefined;
  try {
    const villages = await floodwatchFetch<IoTVillage[]>("/villages", {
      params: { dataset },
    });
    return NextResponse.json(villages);
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
