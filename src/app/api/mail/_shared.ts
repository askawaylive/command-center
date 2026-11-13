import { NextResponse } from "next/server";
import { getBusiness } from "@/lib/businesses";
import { MailError, type Outgoing } from "@/lib/mail";

export async function mailBusiness(id: string | null | undefined) {
  const b = id ? await getBusiness(id) : undefined;
  if (!b?.sources.gmail) throw new MailError("Unknown inbox", 404);
  return b;
}

export function mailError(e: unknown) {
  if (e instanceof MailError) return NextResponse.json({ error: e.message, reconnect: e.reconnect }, { status: e.status });
  return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

export function outgoing(j: Record<string, unknown>): Outgoing {
  return {
    to: str(j.to, 4000),
    cc: str(j.cc, 4000),
    bcc: str(j.bcc, 4000),
    subject: str(j.subject, 1000),
    body: str(j.body, 200_000),
    threadId: str(j.threadId, 100) || undefined,
    inReplyTo: str(j.inReplyTo, 1000) || undefined,
    references: str(j.references, 8000) || undefined,
  };
}
