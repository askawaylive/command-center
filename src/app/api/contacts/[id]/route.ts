import { NextResponse } from "next/server";
import { deleteContact, updateContact } from "@/lib/contacts";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await updateContact(id, await req.json());
  return c ? NextResponse.json(c) : NextResponse.json({ error: "not found" }, { status: 404 });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await deleteContact(id);
  return NextResponse.json({ ok: true });
}
