import { NextResponse } from "next/server";
import { getKV, setKV } from "@/lib/store";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(_req: Request, { params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  if (!DATE_RE.test(date)) return NextResponse.json({ error: "bad date" }, { status: 400 });
  return NextResponse.json({ text: (await getKV<string>(`notes:${date}`)) ?? "" });
}

export async function PUT(req: Request, { params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  if (!DATE_RE.test(date)) return NextResponse.json({ error: "bad date" }, { status: 400 });
  const body = (await req.json().catch(() => ({}))) as { text?: unknown };
  const text = typeof body.text === "string" ? body.text.slice(0, 50_000) : "";
  await setKV(`notes:${date}`, text);
  return NextResponse.json({ ok: true });
}
