import { NextResponse } from "next/server";
import { createJob, listJobs } from "@/lib/jobs";

export async function GET(req: Request) {
  const businessId = new URL(req.url).searchParams.get("businessId") ?? undefined;
  return NextResponse.json(await listJobs(businessId));
}

export async function POST(req: Request) {
  return NextResponse.json(await createJob(await req.json().catch(() => ({}))));
}
