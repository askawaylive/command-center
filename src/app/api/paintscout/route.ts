import { NextResponse } from "next/server";
import { listJobs } from "@/lib/jobs";
import { paintscoutStatus, setPaintscoutOwner, syncPaintscout } from "@/lib/integrations/paintscout";

const bid = (v: unknown) => (typeof v === "string" ? v.replace(/[^a-z0-9]/g, "").slice(0, 32) : "");

export async function GET(req: Request) {
  const businessId = bid(new URL(req.url).searchParams.get("businessId"));
  return NextResponse.json(await paintscoutStatus(businessId));
}

/** Sync now. Body: { businessId, ownerId? } — ownerId picks whose quotes count as yours. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { businessId?: unknown; ownerId?: unknown };
  const businessId = bid(body.businessId);
  if (!businessId) return NextResponse.json({ error: "businessId required" }, { status: 400 });
  if (typeof body.ownerId === "string" && body.ownerId) await setPaintscoutOwner(businessId, body.ownerId.slice(0, 64));
  const status = await syncPaintscout(businessId, { force: true });
  return NextResponse.json({ status, jobs: await listJobs(businessId) });
}
