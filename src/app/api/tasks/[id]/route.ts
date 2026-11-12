import { NextResponse } from "next/server";
import { deleteTask, updateTask } from "@/lib/tasks";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await updateTask(id, await req.json());
  return t ? NextResponse.json(t) : NextResponse.json({ error: "not found" }, { status: 404 });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await deleteTask(id);
  return NextResponse.json({ ok: true });
}
