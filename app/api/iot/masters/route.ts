// GET /api/iot/masters?village_id=&dataset=...
// Lists the LoRa master gateway nodes (no float sensors, just bridges
// LoRa ↔ MQTT). Used by the flood-map village panel.

import { NextRequest, NextResponse } from "next/server";

import {
  FloodwatchFetchError,
  floodwatchFetch,
} from "@/lib/floodwatch/api";
import type { Dataset, IoTMaster } from "@/lib/floodwatch/types";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const params = {
    village_id: sp.get("village_id") ?? undefined,
    dataset: (sp.get("dataset") ?? undefined) as Dataset | undefined,
  };
  try {
    const masters = await floodwatchFetch<IoTMaster[]>("/masters", { params });
    return NextResponse.json(masters);
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
