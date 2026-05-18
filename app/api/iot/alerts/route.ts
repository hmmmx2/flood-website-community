// GET /api/iot/alerts?village_id=&node_id=&alert_type=&from=&to=&page=&page_size=...
// Paginated alert history. Upstream retains 90 days.

import { NextRequest, NextResponse } from "next/server";

import {
  FloodwatchFetchError,
  floodwatchFetch,
} from "@/lib/floodwatch/api";
import type {
  AlertType,
  Dataset,
  IoTAlertsPage,
} from "@/lib/floodwatch/types";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const params = {
    village_id: sp.get("village_id") ?? undefined,
    node_id: sp.get("node_id") ?? undefined,
    alert_type: (sp.get("alert_type") ?? undefined) as AlertType | undefined,
    from: sp.get("from") ?? undefined,
    to: sp.get("to") ?? undefined,
    page: sp.get("page") ?? undefined,
    page_size: sp.get("page_size") ?? undefined,
    dataset: (sp.get("dataset") ?? undefined) as Dataset | undefined,
  };
  try {
    const alerts = await floodwatchFetch<IoTAlertsPage>("/alerts", { params });
    return NextResponse.json(alerts);
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
