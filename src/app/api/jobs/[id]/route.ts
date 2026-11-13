import { NextResponse } from "next/server";
import { deleteJob, updateJob } from "@/lib/jobs";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const j = await updateJob(id, await req.json().catch(() => ({})));
  return j ? NextResponse.json(j) : NextResponse.json({ error: "not found" }, { status: 404 });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await deleteJob(id);
  return NextResponse.json({ ok: true });
}
