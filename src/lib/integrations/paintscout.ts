import "server-only";
import type { Job, JobStatus } from "../types";
import { getKV, listDocs, putDocs, setKV } from "../store";

/**
 * PaintScout OpenAPI (beta): https://openapi.paintscout.com/v2, bearer API key from
 * PaintScout → Account Settings → API Keys. Read-only use: quotes and invoices.
 */
const BASE = process.env.PAINTSCOUT_API_BASE || "https://openapi.paintscout.com/v2";
const STALE_MS = 15 * 60_000;
let running: Promise<unknown> | undefined;

export const paintscoutKey = () => process.env.PAINTSCOUT_API_KEY || undefined;

type Person = { id?: string; firstName?: string | null; lastName?: string | null; email?: string | null; company?: string | null };
interface PSRow {
  id: string;
  number?: string | number | null;
  status?: string | null;
  contact?: Person | null;
  jobAddress?: { address?: string | null; city?: string | null; state?: string | null } | null;
  dates?: { quote?: number | null; sent?: number | null; accepted?: number | null; declined?: number | null } | null;
  totals?: { price?: number | null; afterAdjustment?: number | null; afterDiscount?: number | null; afterTax?: number | null } | null;
  owner?: Person | null;
  parentQuoteId?: string | null;
  childInvoiceId?: string | null;
  timestamp?: { created?: number | null; updated?: number | null } | null;
}

export interface PSOwner {
  id: string;
  name: string;
  email?: string;
  quotes: number;
}
export interface PSStatus {
  connected: boolean;
  lastSync?: string;
  error?: string;
  owners: PSOwner[];
  ownerId?: string;
  imported?: number;
}

async function fetchAll(path: "quotes" | "invoices", key: string): Promise<PSRow[]> {
  const rows: PSRow[] = [];
  for (let page = 1; page <= 60; page++) {
    const url = `${BASE}/${path}?page=${page}&perPage=50&sort=timestamp.updated&sortDir=desc`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${key}`, Accept: "application/json" }, cache: "no-store" });
    if (!r.ok) {
      const body = (await r.json().catch(() => null)) as { errors?: string[] } | null;
      throw new Error(`PaintScout ${path}: ${r.status} ${body?.errors?.join(", ") ?? r.statusText}`);
    }
    const data = (await r.json()) as { totalRows?: number; rows?: PSRow[] };
    const got = data.rows ?? [];
    rows.push(...got);
    if (!got.length || rows.length >= (data.totalRows ?? 0)) break;
  }
  return rows;
}

/** PaintScout dates are numbers; accept epoch seconds or milliseconds. */
function day(n?: number | null): string | undefined {
  if (!n || !Number.isFinite(n)) return undefined;
  const ms = n < 1e12 ? n * 1000 : n;
  const d = new Date(ms);
  if (d.getFullYear() < 2000 || d.getFullYear() > 2100) return undefined;
  return new Date(ms - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}
const name = (p?: Person | null) => [p?.firstName, p?.lastName].filter(Boolean).join(" ").trim();
const RANK: Record<JobStatus, number> = { sent: 0, sold: 1, completed: 2, lost: -1, cancelled: -1 };

function mapStatus(s?: string | null): JobStatus | null {
  switch (s) {
    case "sent":
    case "viewed":
      return "sent";
    case "accepted":
    case "onHold":
    case "disputed":
      return "sold";
    case "invoiced":
    case "partial":
    case "paid":
      return "completed";
    case "declined":
      return "lost";
    default:
      return null; // draft or unknown: not an issued estimate yet
  }
}

export async function paintscoutStatus(businessId: string): Promise<PSStatus> {
  const s = (await getKV<PSStatus>(`paintscout:${businessId}`)) ?? { connected: false, owners: [] };
  return { ...s, connected: Boolean(paintscoutKey()) };
}

export async function setPaintscoutOwner(businessId: string, ownerId: string) {
  const s = await paintscoutStatus(businessId);
  await setKV(`paintscout:${businessId}`, { ...s, ownerId });
}

/** Pull quotes (and their invoices) into this business's jobs. Keeps anything entered by hand (costs, schedule, notes). */
export async function syncPaintscout(businessId: string, opts: { force?: boolean } = {}): Promise<PSStatus> {
  const key = paintscoutKey();
  const status = await paintscoutStatus(businessId);
  if (!key) return status;
  if (!opts.force && status.lastSync && Date.now() - Date.parse(status.lastSync) < STALE_MS) return status;
  // Already synced before: show what we have now and sync in the background, so the page doesn't wait on PaintScout.
  if (!opts.force && status.lastSync) {
    if (!running) running = syncPaintscout(businessId, { force: true }).finally(() => (running = undefined));
    return status;
  }

  try {
    const [quotes, invoices] = await Promise.all([fetchAll("quotes", key), fetchAll("invoices", key).catch(() => [] as PSRow[])]);
    const invoiceByQuote = new Map(invoices.filter((i) => i.parentQuoteId).map((i) => [i.parentQuoteId!, i]));

    const counts = new Map<string, PSOwner>();
    for (const q of quotes) {
      if (!q.owner?.id) continue;
      const o = counts.get(q.owner.id) ?? { id: q.owner.id, name: name(q.owner) || q.owner.email || "Unknown", email: q.owner.email ?? undefined, quotes: 0 };
      o.quotes++;
      counts.set(o.id, o);
    }
    const owners = [...counts.values()].sort((a, b) => b.quotes - a.quotes);
    const ownerId = status.ownerId ?? (owners.length === 1 ? owners[0].id : undefined);

    let imported = 0;
    if (ownerId) {
      const existing = new Map(((await listDocs<Job>("jobs")) ?? []).map((j) => [j.id, j]));
      const out: Job[] = [];
      for (const q of quotes) {
        if (q.owner?.id !== ownerId) continue;
        const inv = invoiceByQuote.get(q.id) ?? (q.childInvoiceId ? invoices.find((i) => i.id === q.childInvoiceId) : undefined);
        const psStatus = mapStatus(inv?.status) === "completed" ? "completed" : mapStatus(q.status);
        if (!psStatus) continue;
        const id = `ps-${q.id}`;
        const prev = existing.get(id);
        const t = q.totals ?? {};
        const amount = Number(t.afterDiscount ?? t.afterAdjustment ?? t.price ?? 0) || 0;
        const sentDate = day(q.dates?.sent) ?? day(q.dates?.quote) ?? day(q.timestamp?.created) ?? new Date().toISOString().slice(0, 10);
        // Never move a job backwards (e.g. you marked it completed before PaintScout invoiced it), except to lost.
        const keepPrev = prev && psStatus !== "lost" && RANK[prev.status] > RANK[psStatus];
        const status: JobStatus = keepPrev ? prev!.status : psStatus;
        const completedDate =
          status === "completed" ? prev?.completedDate ?? day(inv?.dates?.quote) ?? day(inv?.timestamp?.created) ?? day(q.timestamp?.updated) : prev?.completedDate;
        out.push({
          ...(prev ?? {}),
          id,
          businessId,
          customer: q.contact?.company || name(q.contact) || `Quote ${q.number ?? ""}`.trim(),
          address: [q.jobAddress?.address, q.jobAddress?.city].filter(Boolean).join(", ") || prev?.address,
          quoteNumber: q.number != null ? String(q.number) : prev?.quoteNumber,
          amount,
          status,
          sentDate,
          soldDate: status === "sold" || status === "completed" ? prev?.soldDate ?? day(q.dates?.accepted) ?? sentDate : prev?.soldDate,
          completedDate,
          createdAt: prev?.createdAt ?? new Date().toISOString(),
        } as Job);
      }
      if (out.length) await putDocs("jobs", out);
      imported = out.length;
    }

    const next: PSStatus = { connected: true, lastSync: new Date().toISOString(), owners, ownerId, imported };
    await setKV(`paintscout:${businessId}`, next);
    return next;
  } catch (e) {
    const next: PSStatus = { ...status, connected: true, error: e instanceof Error ? e.message : String(e) };
    await setKV(`paintscout:${businessId}`, { ...next, lastSync: status.lastSync });
    return next;
  }
}
