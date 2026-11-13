import { NextResponse } from "next/server";
import { getBusiness } from "@/lib/businesses";
import { GmailReconnectError, replyGmail } from "@/lib/integrations/gmail";
import { clearCache } from "@/lib/cache";

export async function POST(req: Request) {
  const { businessId, emailId, body } = (await req.json().catch(() => ({}))) as { businessId?: string; emailId?: string; body?: string };
  if (!businessId || !emailId || !body?.trim()) return NextResponse.json({ error: "Write a message first" }, { status: 400 });
  if (body.length > 50_000) return NextResponse.json({ error: "That message is too long" }, { status: 400 });
  const b = await getBusiness(businessId);
  if (!b) return NextResponse.json({ error: "Unknown business" }, { status: 404 });
  try {
    const r = await replyGmail(b, emailId, body);
    clearCache();
    return NextResponse.json({ ok: true, to: r.to });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg, reconnect: e instanceof GmailReconnectError }, { status: e instanceof GmailReconnectError ? 403 : 502 });
  }
}
