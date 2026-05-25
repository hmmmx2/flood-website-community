import { NextRequest, NextResponse } from "next/server";

const AI_API_URL = process.env.AI_API_URL ?? "http://localhost:8000";
const VALID_SCALES = new Set(["daily", "weekly", "monthly", "hourly"]);

function validYear(value: string): boolean {
  const year = Number(value);
  return Number.isInteger(year) && year >= 2020 && year <= 2100;
}

function validDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const scale = searchParams.get("scale") ?? "monthly";
  const year = searchParams.get("year") ?? new Date().getFullYear().toString();
  const date = searchParams.get("date") ?? new Date().toISOString().split("T")[0];
  const allowedParams = new Set(["scale", "year", "date"]);

  for (const key of searchParams.keys()) {
    if (!allowedParams.has(key)) {
      return NextResponse.json({ success: false, error: "Unexpected query parameter" }, { status: 400 });
    }
  }

  if (!VALID_SCALES.has(scale)) {
    return NextResponse.json({ success: false, error: "Invalid scale" }, { status: 400 });
  }
  if (scale === "hourly" && !validDate(date)) {
    return NextResponse.json({ success: false, error: "Invalid date" }, { status: 400 });
  }
  if (scale !== "hourly" && !validYear(year)) {
    return NextResponse.json({ success: false, error: "Invalid year" }, { status: 400 });
  }

  try {
    let endpoint = "";
    if (scale === "daily") endpoint = `/api/v1/predict/daily?year=${year}`;
    else if (scale === "weekly") endpoint = `/api/v1/predict/weekly?year=${year}`;
    else if (scale === "hourly") endpoint = `/api/v1/predict/hourly?date=${date}`;
    else endpoint = `/api/v1/predict/monthly?year=${year}`;

    const upstream = await fetch(`${AI_API_URL}${endpoint}`, {
      headers: process.env.AI_SERVICE_API_KEY
        ? { "X-AI-Service-Key": process.env.AI_SERVICE_API_KEY }
        : undefined,
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
