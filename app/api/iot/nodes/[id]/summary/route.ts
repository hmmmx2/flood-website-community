// GET /api/iot/nodes/{id}/summary?period=today|week|month
// Per-node aggregate (averages, min/max, alerts by type).

import { NextRequest, NextResponse } from "next/server";

import {
  FloodwatchFetchError,
  floodwatchFetch,
} from "@/lib/floodwatch/api";
import type { Dataset, IoTNodeSummary } from "@/lib/floodwatch/types";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const sp = req.nextUrl.searchParams;
  const params = {
    period: sp.get("period") ?? undefined,
    from: sp.get("from") ?? undefined,
    to: sp.get("to") ?? undefined,
    dataset: (sp.get("dataset") ?? undefined) as Dataset | undefined,
  };
  try {
    const summary = await floodwatchFetch<IoTNodeSummary>(
      `/nodes/${encodeURIComponent(id)}/summary`,
      { params },
    );
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
