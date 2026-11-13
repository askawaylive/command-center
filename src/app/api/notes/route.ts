import { NextResponse } from "next/server";
import { listNotes } from "@/lib/notes";

export async function GET() {
  return NextResponse.json(await listNotes());
}
