import "server-only";
import { randomUUID } from "node:crypto";
import type { Job, JobStatus } from "./types";
import { deleteDoc, listDocs, putDocs } from "./store";
import { autoSchedule } from "./commission";

const COLL = "jobs";
const STATUSES: JobStatus[] = ["sent", "sold", "completed", "lost", "cancelled"];
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) || undefined : undefined);
const date = (v: unknown) => (typeof v === "string" && DATE.test(v) ? v : undefined);
const money = (v: unknown) => {
  const n = typeof v === "string" ? Number(v.replace(/[$,\s]/g, "")) : v;
  return typeof n === "number" && Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : undefined;
};

function clean(input: Partial<Job>): Partial<Job> {
  const out: Partial<Job> = {};
  if ("businessId" in input) out.businessId = str(input.businessId, 32) ?? "";
  if ("customer" in input) out.customer = str(input.customer, 120) ?? "Unnamed job";
  if ("address" in input) out.address = str(input.address, 200);
  if ("quoteNumber" in input) out.quoteNumber = str(input.quoteNumber, 40);
  if ("amount" in input) out.amount = money(input.amount) ?? 0;
  if ("costPct" in input) {
    const c = money(input.costPct);
    out.costPct = c !== undefined && c <= 100 ? c : undefined;
  }
  if ("actualCost" in input) out.actualCost = money(input.actualCost);
  if ("likelihood" in input) {
    const l = Number(input.likelihood);
    out.likelihood = input.likelihood != null && Number.isFinite(l) ? Math.min(100, Math.max(0, Math.round(l))) : undefined;
  }
  if ("status" in input) out.status = STATUSES.includes(input.status as JobStatus) ? input.status : "sent";
  if ("sentDate" in input) out.sentDate = date(input.sentDate) ?? new Date().toISOString().slice(0, 10);
  for (const k of ["soldDate", "startDate", "scheduledDate", "completedDate"] as const) if (k in input) out[k] = date(input[k]);
  if ("notes" in input) out.notes = str(input.notes, 5000);
  return out;
}

/**
 * Keep start/finish in step with the sold date: a newly sold job (or one whose sold date moves)
 * gets start = sold + 2 weeks and finish = start + 1 week, unless those dates were set by hand.
 */
function withSchedule(prev: Partial<Job>, next: Job, patch: Partial<Job>): Job {
  if ("startDate" in patch || "scheduledDate" in patch) return { ...next, scheduleAuto: false };
  if (!next.soldDate) return prev.scheduleAuto ? { ...next, startDate: undefined, scheduledDate: undefined, scheduleAuto: undefined } : next;
  const manual = !next.scheduleAuto && (next.startDate || next.scheduledDate);
  if (manual || (next.soldDate === prev.soldDate && next.scheduledDate)) return next;
  return { ...next, ...autoSchedule(next.soldDate) };
}

export async function listJobs(businessId?: string): Promise<Job[]> {
  const all = (await listDocs<Job>(COLL)) ?? [];
  // Sold jobs with no dates yet (older ones, or from PaintScout) get the automatic schedule.
  const fill = all.filter((j) => j.status === "sold" && j.soldDate && !j.startDate && !j.scheduledDate);
  if (fill.length) {
    for (const j of fill) Object.assign(j, autoSchedule(j.soldDate!));
    await putDocs(COLL, fill);
  }
  return all.filter((j) => !businessId || j.businessId === businessId).sort((a, b) => b.sentDate.localeCompare(a.sentDate) || b.createdAt.localeCompare(a.createdAt));
}

export async function createJob(input: Partial<Job>): Promise<Job> {
  const c = clean({ status: "sent", sentDate: undefined, amount: 0, customer: "", ...input });
  const j = withSchedule({}, { ...c, id: randomUUID(), createdAt: new Date().toISOString() } as Job, c);
  await putDocs(COLL, [j]);
  return j;
}

export async function updateJob(id: string, patch: Partial<Job>): Promise<Job | undefined> {
  const j = (await listDocs<Job>(COLL))?.find((x) => x.id === id);
  if (!j) return undefined;
  const c = clean(patch);
  const next = withSchedule(j, { ...j, ...c, id }, c);
  await putDocs(COLL, [next]);
  return next;
}

export async function deleteJob(id: string) {
  await deleteDoc(COLL, id);
}
