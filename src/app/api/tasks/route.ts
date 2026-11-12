import { NextResponse } from "next/server";
import { createTask, listTasks } from "@/lib/tasks";

export async function GET(req: Request) {
  const businessId = new URL(req.url).searchParams.get("business") ?? undefined;
  return NextResponse.json(await listTasks({ businessId }));
}

export async function POST(req: Request) {
  const body = await req.json();
  if (!body.title || !body.businessId) return NextResponse.json({ error: "title and businessId required" }, { status: 400 });
  return NextResponse.json(await createTask(body));
}
