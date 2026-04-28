import { NextRequest, NextResponse } from "next/server";
import { javaFetch } from "@/lib/javaApi";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const data = await javaFetch(`/blogs/${id}`);
    return NextResponse.json(data);
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number };
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
