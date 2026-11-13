import { NextResponse } from "next/server";
import { deletePhoto } from "@/lib/photos";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await deletePhoto(id);
  return NextResponse.json({ ok: true });
}
