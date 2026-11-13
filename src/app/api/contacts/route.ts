import { NextResponse } from "next/server";
import { createContact, listContacts } from "@/lib/contacts";

export async function GET() {
  return NextResponse.json(await listContacts());
}

export async function POST(req: Request) {
  return NextResponse.json(await createContact(await req.json()));
}
