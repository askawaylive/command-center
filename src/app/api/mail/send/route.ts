import { NextResponse } from "next/server";
import { forgetCounts, sendMail } from "@/lib/mail";
import { clearCache } from "@/lib/cache";
import { mailBusiness, mailError, outgoing } from "../_shared";

export async function POST(req: Request) {
  const j = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    const b = await mailBusiness(j.business as string);
    await sendMail(b, outgoing(j), typeof j.draftId === "string" ? j.draftId : undefined);
    clearCache();
    forgetCounts();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return mailError(e);
  }
}
