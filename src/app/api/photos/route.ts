import { NextResponse } from "next/server";
import { addPhoto, listPhotos } from "@/lib/photos";

export async function GET() {
  return NextResponse.json(await listPhotos());
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { src?: unknown };
  const p = await addPhoto(body.src);
  return p ? NextResponse.json(p) : NextResponse.json({ error: "That image is too large or not a supported type." }, { status: 400 });
}
