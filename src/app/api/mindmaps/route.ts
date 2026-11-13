import { NextResponse } from "next/server";
import { createMap, listMaps } from "@/lib/mindmaps";

export async function GET() {
  return NextResponse.json(await listMaps());
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { title?: unknown };
  return NextResponse.json(await createMap(body.title));
}
