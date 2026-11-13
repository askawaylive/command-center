import { NextResponse } from "next/server";
import { getKV, setKV } from "@/lib/store";

/** Small UI preferences that should follow Scott across devices. Only these keys are accepted. */
const ALLOWED = new Set(["layout:today", "photos:interval"]);

export async function GET(_req: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  if (!ALLOWED.has(key)) return NextResponse.json({ error: "unknown key" }, { status: 404 });
  return NextResponse.json({ value: (await getKV(`pref:${key}`)) ?? null });
}

export async function PUT(req: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  if (!ALLOWED.has(key)) return NextResponse.json({ error: "unknown key" }, { status: 404 });
  const text = await req.text();
  if (text.length > 20_000) return NextResponse.json({ error: "too large" }, { status: 413 });
  const body = JSON.parse(text || "{}") as { value?: unknown };
  await setKV(`pref:${key}`, body.value ?? null);
  return NextResponse.json({ ok: true });
}
