import { NextResponse } from "next/server";
import { deleteDraft, getDraft, saveDraft } from "@/lib/mail";
import { mailBusiness, mailError, outgoing } from "../_shared";

export async function GET(req: Request) {
  const u = new URL(req.url);
  try {
    const b = await mailBusiness(u.searchParams.get("business"));
    return NextResponse.json(await getDraft(b, u.searchParams.get("id") ?? ""));
  } catch (e) {
    return mailError(e);
  }
}

export async function POST(req: Request) {
  const j = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    const b = await mailBusiness(j.business as string);
    const d = await saveDraft(b, outgoing(j), typeof j.draftId === "string" && j.draftId ? j.draftId : undefined);
    return NextResponse.json({ draftId: d.id });
  } catch (e) {
    return mailError(e);
  }
}

export async function DELETE(req: Request) {
  const u = new URL(req.url);
  try {
    const b = await mailBusiness(u.searchParams.get("business"));
    await deleteDraft(b, u.searchParams.get("id") ?? "");
    return NextResponse.json({ ok: true });
  } catch (e) {
    return mailError(e);
  }
}
