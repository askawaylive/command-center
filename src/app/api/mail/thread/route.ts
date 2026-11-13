import { NextResponse } from "next/server";
import { getThread, threadAction, type ThreadAction } from "@/lib/mail";
import { clearCache } from "@/lib/cache";
import { mailBusiness, mailError } from "../_shared";

const ACTIONS = new Set<ThreadAction>(["archive", "inbox", "trash", "untrash", "spam", "notspam", "read", "unread", "star", "unstar"]);

export async function GET(req: Request) {
  const u = new URL(req.url);
  try {
    const b = await mailBusiness(u.searchParams.get("business"));
    const id = u.searchParams.get("id") ?? "";
    const t = await getThread(b, id);
    if (t.messages.some((m) => m.unread)) await threadAction(b, id, "read").catch(() => {});
    return NextResponse.json(t);
  } catch (e) {
    return mailError(e);
  }
}

/** Apply one action to one or more conversations: { items: [{business, id}], action }. */
export async function POST(req: Request) {
  const j = (await req.json().catch(() => ({}))) as { items?: { business?: string; id?: string }[]; action?: ThreadAction };
  if (!j.action || !ACTIONS.has(j.action) || !Array.isArray(j.items) || !j.items.length || j.items.length > 100)
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  try {
    for (const it of j.items) {
      const b = await mailBusiness(it.business);
      if (typeof it.id !== "string" || !it.id) continue;
      await threadAction(b, it.id, j.action);
    }
    clearCache();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return mailError(e);
  }
}
