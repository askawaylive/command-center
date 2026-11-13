import { NextResponse } from "next/server";
import { getNote, isDate, saveNote } from "@/lib/notes";

export async function GET(_req: Request, { params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  if (!isDate(date)) return NextResponse.json({ error: "bad date" }, { status: 400 });
  const n = await getNote(date);
  return NextResponse.json({ text: n.html, tags: n.tags });
}

/** Body: { text?: string (HTML), tags?: string[] } */
export async function PUT(req: Request, { params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  if (!isDate(date)) return NextResponse.json({ error: "bad date" }, { status: 400 });
  const body = (await req.json().catch(() => ({}))) as { text?: unknown; tags?: unknown };
  await saveNote(date, { html: body.text, tags: body.tags });
  return NextResponse.json({ ok: true });
}
