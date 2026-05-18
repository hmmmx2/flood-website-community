// GET /api/iot/nodes?village_id=&status=&dataset=...
// Returns the live list of river sensor nodes with their latest reading.

import { NextRequest, NextResponse } from "next/server";

import {
  FloodwatchFetchError,
  floodwatchFetch,
} from "@/lib/floodwatch/api";
import type { Dataset, IoTNode, NodeStatus } from "@/lib/floodwatch/types";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const params = {
    village_id: sp.get("village_id") ?? undefined,
    status: (sp.get("status") ?? undefined) as NodeStatus | undefined,
    dataset: (sp.get("dataset") ?? undefined) as Dataset | undefined,
  };
  try {
    const nodes = await floodwatchFetch<IoTNode[]>("/nodes", { params });
    return NextResponse.json(nodes);
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
