import { NextRequest, NextResponse } from "next/server";

const AI_API_URL = process.env.AI_API_URL ?? "http://localhost:8000";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const scale = searchParams.get("scale") ?? "monthly";
  const year = searchParams.get("year") ?? new Date().getFullYear().toString();
  const date = searchParams.get("date") ?? new Date().toISOString().split("T")[0];

  try {
    let endpoint = "";
    if (scale === "daily") endpoint = `/api/v1/predict/daily?year=${year}`;
    else if (scale === "weekly") endpoint = `/api/v1/predict/weekly?year=${year}`;
    else if (scale === "hourly") endpoint = `/api/v1/predict/hourly?date=${date}`;
    else endpoint = `/api/v1/predict/monthly?year=${year}`;

    const upstream = await fetch(`${AI_API_URL}${endpoint}`, {
      signal: AbortSignal.timeout(5000),
    });

    if (!upstream.ok) {
      return NextResponse.json({ success: false, error: "AI service unavailable" }, { status: 502 });
    }

    const data = await upstream.json();
    return NextResponse.json({ success: true, ...data });
  } catch {
    return NextResponse.json({ success: false, error: "AI service offline" }, { status: 503 });
  }
}
