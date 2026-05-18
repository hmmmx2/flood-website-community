// GET /api/iot/nodes/{id}/readings?from=&to=&page=&page_size=&gps_only=&dataset=...
// Paginated heartbeat history. 30-day TTL upstream.

import { NextRequest, NextResponse } from "next/server";

import {
  FloodwatchFetchError,
  floodwatchFetch,
} from "@/lib/floodwatch/api";
import type { Dataset, IoTReadingsPage } from "@/lib/floodwatch/types";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const sp = req.nextUrl.searchParams;
  const params = {
    from: sp.get("from") ?? undefined,
    to: sp.get("to") ?? undefined,
    page: sp.get("page") ?? undefined,
    page_size: sp.get("page_size") ?? undefined,
    gps_only: sp.get("gps_only") ?? undefined,
    dataset: (sp.get("dataset") ?? undefined) as Dataset | undefined,
  };
  try {
    const readings = await floodwatchFetch<IoTReadingsPage>(
      `/nodes/${encodeURIComponent(id)}/readings`,
      { params },
    );
    return NextResponse.json(readings);
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
