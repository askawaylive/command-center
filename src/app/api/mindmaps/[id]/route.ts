import { NextResponse } from "next/server";
import { deleteMap, updateMap } from "@/lib/mindmaps";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = await updateMap(id, await req.json().catch(() => ({})));
  return m ? NextResponse.json(m) : NextResponse.json({ error: "not found" }, { status: 404 });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await deleteMap(id);
  return NextResponse.json({ ok: true });
}
