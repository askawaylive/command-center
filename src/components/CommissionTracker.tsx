"use client";
import { useEffect, useMemo, useState } from "react";
import type { Business, Job, JobStatus } from "@/lib/types";
import { isoDay } from "@/lib/dates";
import {
  annualBonus,
  commissionSettings,
  jobCommission,
  jobCost,
  jobProfit,
  monthLabel,
  monthOf,
  monthlyBonus,
  nextAnnualTier,
  nextMonth,
  nextMonthlyTier,
  payouts,
  salesInMonth,
  salesInYear,
  winRate,
} from "@/lib/commission";
import { Icon } from "./Icon";

const money = (n: number, cents = false) =>
  n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: cents ? 2 : 0, minimumFractionDigits: cents ? 2 : 0 });
const pct = (n: number) => `${Math.round(n * 100)}%`;
const shortDate = (iso?: string) => (iso ? new Date(iso + "T00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "");

const STATUS: Record<JobStatus, { label: string; cls: string }> = {
  sent: { label: "Estimate sent", cls: "bg-sidebar text-muted" },
  sold: { label: "Sold", cls: "bg-accent-soft text-accent" },
  completed: { label: "Completed", cls: "bg-[color-mix(in_srgb,var(--good)_16%,transparent)] text-good" },
  lost: { label: "Lost", cls: "bg-sidebar text-faint" },
  cancelled: { label: "Cancelled", cls: "bg-sidebar text-faint" },
};
const FILTERS: { id: "open" | JobStatus | "all"; label: string }[] = [
  { id: "open", label: "Open" },
  { id: "sent", label: "Sent" },
  { id: "sold", label: "Sold" },
  { id: "completed", label: "Completed" },
  { id: "lost", label: "Lost" },
  { id: "all", label: "All" },
];

function Tile({ label, value, sub, children }: { label: string; value: string; sub?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="card p-4">
      <div className="text-[12px] text-muted">{label}</div>
      <div className="mt-1 text-[26px] font-semibold leading-none tabular-nums">{value}</div>
      {children}
      {sub && <div className="mt-2 text-[12px] text-muted">{sub}</div>}
    </div>
  );
}
function Bar({ value, max, ok = true }: { value: number; max: number; ok?: boolean }) {
  return (
    <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-line">
      <div className="h-full rounded-full" style={{ width: `${Math.min(100, (value / max) * 100)}%`, background: ok ? "var(--accent)" : "var(--bad)" }} />
    </div>
  );
}

/** Statuses move forward with sensible dates filled in. */
function statusPatch(j: Job, status: JobStatus, today: string): Partial<Job> {
  const p: Partial<Job> = { status };
  if ((status === "sold" || status === "completed") && !j.soldDate) p.soldDate = today;
  if (status === "completed" && !j.completedDate) p.completedDate = today;
  if (status === "sent") Object.assign(p, { soldDate: undefined, completedDate: undefined });
  if (status === "sold") p.completedDate = undefined;
  return p;
}

function JobEditor({
  job,
  settings,
  onChange,
  onDelete,
  onClose,
  today,
}: {
  job: Job;
  settings: { rate: number; costPct: number };
  onChange: (p: Partial<Job>) => void;
  onDelete: () => void;
  onClose: () => void;
  today: string;
}) {
  const [d, setD] = useState(job);
  useEffect(() => setD(job), [job]);
  const commit = (p: Partial<Job>) => {
    setD({ ...d, ...p });
    onChange(p);
  };
  const text = (k: "customer" | "address" | "quoteNumber" | "notes") => ({
    value: d[k] ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setD({ ...d, [k]: e.target.value }),
    onBlur: () => d[k] !== job[k] && onChange({ [k]: d[k] }),
  });
  const num = (k: "amount" | "costPct" | "actualCost") => ({
    type: "number",
    inputMode: "decimal" as const,
    value: d[k] ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setD({ ...d, [k]: e.target.value === "" ? undefined : Number(e.target.value) }),
    onBlur: () => d[k] !== job[k] && onChange({ [k]: d[k] ?? null } as Partial<Job>),
  });
  const row = "grid grid-cols-[110px_1fr] items-center gap-3 text-[13px]";
  const cost = jobCost(d, settings.costPct);
  const profit = jobProfit(d, settings.costPct);
  const payMonth = d.status === "completed" && d.completedDate ? nextMonth(monthOf(d.completedDate)!) : d.status === "sold" && d.scheduledDate ? nextMonth(monthOf(d.scheduledDate)!) : null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <span className={`rounded-full px-2 py-0.5 text-[12px] ${STATUS[d.status].cls}`}>{STATUS[d.status].label}</span>
        <button onClick={onDelete} aria-label="Delete job" className="ml-auto rounded-md p-1.5 text-faint hover:bg-sidebar hover:text-bad">
          <Icon name="trash" size={15} />
        </button>
        <button onClick={onClose} aria-label="Close" className="rounded-md p-1.5 text-faint hover:bg-sidebar hover:text-ink">
          <Icon name="x" size={15} />
        </button>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto scroll-thin p-4 pb-24">
        <input {...text("customer")} placeholder="Customer" aria-label="Customer" className="w-full bg-transparent text-[18px] font-semibold outline-none" />

        <div className="rounded-xl bg-sidebar/70 p-3 text-[13px]">
          <div className="flex justify-between"><span className="text-muted">Price</span><span className="tabular-nums">{money(d.amount)}</span></div>
          <div className="flex justify-between"><span className="text-muted">Direct cost {d.actualCost === undefined ? `(${d.costPct ?? settings.costPct}% est.)` : "(actual)"}</span><span className="tabular-nums">−{money(cost)}</span></div>
          <div className="flex justify-between border-t border-line pt-1 mt-1"><span className="text-muted">Gross profit</span><span className="tabular-nums">{money(profit)}</span></div>
          <div className="mt-1 flex justify-between font-semibold"><span>Your {settings.rate}%</span><span className="tabular-nums text-accent">{money(jobCommission(d, settings), true)}</span></div>
          <div className="mt-1 text-[12px] text-muted">
            {d.status === "completed" ? `Paid early ${monthLabel(payMonth!, { month: "long" })}` : d.status === "sold" ? (payMonth ? `Expected early ${monthLabel(payMonth, { month: "long" })} if it's done by ${shortDate(d.scheduledDate)}` : "Paid the month after it's completed. Add a scheduled date to see when.") : d.status === "sent" ? "Not sold yet" : "No commission"}
          </div>
        </div>

        <div className="space-y-2.5">
          <label className={row}><span className="text-muted">Status</span>
            <select className="input !py-1.5" value={d.status} onChange={(e) => commit(statusPatch(d, e.target.value as JobStatus, today))}>
              {(Object.keys(STATUS) as JobStatus[]).map((s) => <option key={s} value={s}>{STATUS[s].label}</option>)}
            </select>
          </label>
          <label className={row}><span className="text-muted">Price ($)</span><input className="input !py-1.5" min={0} step={50} {...num("amount")} /></label>
          <label className={row}><span className="text-muted">Estimate sent</span><input type="date" className="input !py-1.5" value={d.sentDate} onChange={(e) => commit({ sentDate: e.target.value || today })} /></label>
          <label className={row}><span className="text-muted">Sold</span><input type="date" className="input !py-1.5" value={d.soldDate ?? ""} onChange={(e) => commit({ soldDate: e.target.value || undefined })} /></label>
          <label className={row}><span className="text-muted">Scheduled finish</span><input type="date" className="input !py-1.5" value={d.scheduledDate ?? ""} onChange={(e) => commit({ scheduledDate: e.target.value || undefined })} /></label>
          <label className={row}><span className="text-muted">Completed</span><input type="date" className="input !py-1.5" value={d.completedDate ?? ""} onChange={(e) => commit({ completedDate: e.target.value || undefined })} /></label>
          <label className={row}><span className="text-muted">Cost % (est.)</span><input className="input !py-1.5" min={0} max={100} placeholder={`${settings.costPct}`} {...num("costPct")} /></label>
          <label className={row}><span className="text-muted">Actual cost ($)</span><input className="input !py-1.5" min={0} placeholder="Once reconciled" {...num("actualCost")} /></label>
          <label className={row}><span className="text-muted">Quote #</span><input className="input !py-1.5" placeholder="PaintScout quote number" {...text("quoteNumber")} /></label>
          <label className={row}><span className="text-muted">Address</span><input className="input !py-1.5" {...text("address")} /></label>
        </div>
        <label className="block">
          <span className="mb-1 block text-[13px] text-muted">Notes</span>
          <textarea rows={4} className="input resize-y" {...text("notes")} />
        </label>
      </div>
    </div>
  );
}

export function CommissionTracker({ business, initial }: { business: Business; initial: Job[] }) {
  const s = commissionSettings(business);
  const [jobs, setJobs] = useState(initial);
  const [today, setToday] = useState(() => isoDay());
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("open");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ customer: "", amount: "", status: "sent" as JobStatus, sentDate: today });
  useEffect(() => setToday(isoDay()), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSelectedId(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const thisMonth = today.slice(0, 7);
  const lastMonth = (() => {
    const [y, m] = thisMonth.split("-").map(Number);
    return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
  })();
  const month = useMemo(() => salesInMonth(jobs, thisMonth, s.costPct), [jobs, thisMonth, s.costPct]);
  const bonus = monthlyBonus(month.volume, month.margin);
  const nextTier = nextMonthlyTier(month.volume);
  const year = salesInYear(jobs, today.slice(0, 4));
  const nextYear = nextAnnualTier(year);
  const wr = winRate(jobs, today);
  const sched = useMemo(() => payouts(jobs, s), [jobs, s]);
  const nextPay = sched.list.find((p) => p.month === nextMonth(thisMonth));
  const paidSoon = sched.list.find((p) => p.month === thisMonth);
  const pipeline = jobs.filter((j) => j.status === "sold");
  const pipelineComm = pipeline.reduce((t, j) => t + jobCommission(j, s), 0);
  const sentOpen = jobs.filter((j) => j.status === "sent");

  const visible = jobs.filter((j) => (filter === "all" ? true : filter === "open" ? j.status === "sent" || j.status === "sold" : j.status === filter));
  const selected = jobs.find((j) => j.id === selectedId);

  const patch = async (id: string, p: Partial<Job>) => {
    setJobs((js) => js.map((j) => (j.id === id ? { ...j, ...p } : j)));
    // undefined → null so cleared dates are actually cleared on the server.
    const r = await fetch(`/api/jobs/${id}`, { method: "PATCH", body: JSON.stringify(p, (_k, v) => (v === undefined ? null : v)) });
    if (r.ok) {
      const saved = (await r.json()) as Job;
      setJobs((js) => js.map((j) => (j.id === id ? saved : j)));
    }
  };
  const add = async () => {
    if (!form.customer.trim() || !form.amount) return;
    const body: Partial<Job> = { businessId: business.id, customer: form.customer, amount: Number(form.amount.replace(/[$,]/g, "")), status: form.status, sentDate: form.sentDate };
    if (form.status !== "sent") body.soldDate = today;
    if (form.status === "completed") body.completedDate = today;
    const r = await fetch("/api/jobs", { method: "POST", body: JSON.stringify(body) });
    const j = (await r.json()) as Job;
    setJobs((js) => [j, ...js]);
    setForm({ customer: "", amount: "", status: "sent", sentDate: today });
    setAdding(false);
  };

  return (
    <div className="flex">
      <div className={`min-w-0 flex-1 space-y-6 transition-[padding] ${selected ? "lg:pr-[372px]" : ""}`}>
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <Tile
            label={`Payday · early ${monthLabel(nextMonth(thisMonth), { month: "long" })}`}
            value={money((nextPay?.commission ?? 0) + (nextPay?.bonus ?? 0))}
            sub={
              nextPay
                ? `${nextPay.jobs.length} job${nextPay.jobs.length === 1 ? "" : "s"} finishing in ${monthLabel(thisMonth, { month: "long" })}${nextPay.bonus ? ` + ${money(nextPay.bonus)} bonus` : ""}${nextPay.expected ? " (some scheduled)" : ""}`
                : `Jobs completed in ${monthLabel(thisMonth, { month: "long" })} pay out then`
            }
          />
          <Tile label={`Sold in ${monthLabel(thisMonth, { month: "long" })}`} value={money(month.volume)} sub={bonus ? `${money(bonus)} bonus earned · ${money(nextTier - month.volume)} to the next $500` : month.volume && month.margin < 0.45 && month.volume >= 100_000 ? `Margin ${pct(month.margin)}: needs 45% for the bonus` : `${money(nextTier - month.volume)} more for a ${money(monthlyBonus(nextTier, 1))} bonus`}>
            <Bar value={month.volume} max={nextTier} ok={!month.volume || month.margin >= 0.45} />
          </Tile>
          <Tile label="Sold, not finished" value={money(pipelineComm)} sub={`Commission waiting on ${pipeline.length} job${pipeline.length === 1 ? "" : "s"} (${money(pipeline.reduce((t, j) => t + j.amount, 0))})`} />
          <Tile label="Win rate · 90 days" value={wr.rate === null ? "–" : pct(wr.rate)} sub={wr.rate === null ? "No estimates in the last 90 days" : `${wr.won} of ${wr.issued} estimates accepted · minimum 40%`}>
            {wr.rate !== null && <Bar value={wr.rate} max={1} ok={wr.rate >= 0.4} />}
          </Tile>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,340px)]">
          <section className="card p-5">
            <h2 className="text-[17px]">Payout schedule</h2>
            <p className="mt-0.5 text-[13px] text-muted">Commission lands the month after a job is completed. Bonuses land the month after the sale month.</p>
            <div className="mt-4 divide-y divide-line">
              {paidSoon && (
                <PayRow label={`Early ${monthLabel(paidSoon.month, { month: "long" })}`} note={`for ${monthLabel(lastMonth, { month: "long" })} work`} p={paidSoon} />
              )}
              {sched.list
                .filter((p) => p.month > thisMonth)
                .map((p) => (
                  <PayRow key={p.month} label={`Early ${monthLabel(p.month, { month: "long", year: p.month.slice(0, 4) !== thisMonth.slice(0, 4) ? "numeric" : undefined })}`} note={p.expected ? "includes scheduled jobs" : undefined} p={p} />
                ))}
              {sched.unscheduled.length > 0 && (
                <div className="flex items-center justify-between py-2.5 text-[14px]">
                  <div>
                    <div>Not scheduled yet</div>
                    <div className="text-[12px] text-muted">{sched.unscheduled.length} sold job{sched.unscheduled.length === 1 ? "" : "s"} without a finish date</div>
                  </div>
                  <span className="tabular-nums text-muted">{money(sched.unscheduled.reduce((t, j) => t + jobCommission(j, s), 0))}</span>
                </div>
              )}
              {!paidSoon && !sched.list.some((p) => p.month > thisMonth) && !sched.unscheduled.length && (
                <p className="py-3 text-[13px] text-faint">Nothing scheduled yet. Mark jobs sold or completed to see payouts here.</p>
              )}
            </div>
          </section>
          <section className="card p-5">
            <h2 className="text-[17px]">{today.slice(0, 4)} production</h2>
            <div className="mt-2 text-[26px] font-semibold tabular-nums">{money(year)}</div>
            <div className="text-[13px] text-muted">sold this year · annual bonus {annualBonus(year) ? money(annualBonus(year)) : "not reached yet"}</div>
            {nextYear && (
              <>
                <Bar value={year} max={nextYear[0]} />
                <div className="mt-2 text-[12px] text-muted">{money(nextYear[0] - year)} more to reach {money(nextYear[0])} ({money(nextYear[1])} bonus, paid in January)</div>
              </>
            )}
            <div className="mt-4 border-t border-line pt-3 text-[12px] text-muted">
              {sentOpen.length} estimate{sentOpen.length === 1 ? "" : "s"} out worth {money(sentOpen.reduce((t, j) => t + j.amount, 0))}. If they all close: about {money(sentOpen.reduce((t, j) => t + jobCommission(j, s), 0))} commission.
            </div>
          </section>
        </div>

        <section>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h2 className="mr-2 text-[20px]">Jobs</h2>
            {FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`rounded-full border px-3 py-1 text-[13px] transition-colors ${filter === f.id ? "border-ink bg-ink text-bg" : "border-line text-muted hover:text-ink"}`}
              >
                {f.label}
              </button>
            ))}
            <button onClick={() => setAdding(true)} className="btn btn-primary ml-auto">
              <Icon name="plus" size={14} /> Add estimate
            </button>
          </div>

          {adding && (
            <div className="card mb-3 flex flex-wrap items-end gap-3 p-3">
              <label className="min-w-[180px] flex-1 text-[12px] text-muted">Customer
                <input autoFocus className="input mt-1" value={form.customer} onChange={(e) => setForm({ ...form, customer: e.target.value })} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="e.g. Johnson exterior" />
              </label>
              <label className="w-36 text-[12px] text-muted">Price ($)
                <input className="input mt-1" inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="10,000" />
              </label>
              <label className="w-40 text-[12px] text-muted">Status
                <select className="input mt-1" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as JobStatus })}>
                  <option value="sent">Estimate sent</option>
                  <option value="sold">Sold</option>
                  <option value="completed">Completed</option>
                </select>
              </label>
              <label className="w-40 text-[12px] text-muted">Estimate sent
                <input type="date" className="input mt-1" value={form.sentDate} onChange={(e) => setForm({ ...form, sentDate: e.target.value })} />
              </label>
              <div className="flex gap-1">
                <button className="btn btn-ghost" onClick={() => setAdding(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={add} disabled={!form.customer.trim() || !form.amount}>Add</button>
              </div>
            </div>
          )}

          <div className="card overflow-x-auto">
            <table className="w-full min-w-[760px] whitespace-nowrap text-[13px]">
              <thead>
                <tr className="border-b border-line text-left text-[12px] text-muted">
                  <th className="px-4 py-2.5 font-normal">Customer</th>
                  <th className="px-3 py-2.5 text-right font-normal">Price</th>
                  <th className="px-3 py-2.5 font-normal">Status</th>
                  <th className="px-3 py-2.5 font-normal">Sent</th>
                  <th className="px-3 py-2.5 font-normal">Sold</th>
                  <th className="px-3 py-2.5 font-normal">Finished</th>
                  <th className="px-3 py-2.5 text-right font-normal">Commission</th>
                  <th className="px-4 py-2.5 font-normal">Paid</th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-faint">{jobs.length ? "No jobs here." : "No jobs yet. Add your first estimate above."}</td></tr>
                )}
                {visible.map((j) => {
                  const pay = j.status === "completed" && j.completedDate ? nextMonth(monthOf(j.completedDate)!) : j.status === "sold" && j.scheduledDate ? nextMonth(monthOf(j.scheduledDate)!) : null;
                  const dead = j.status === "lost" || j.status === "cancelled";
                  return (
                    <tr key={j.id} onClick={() => setSelectedId(j.id)} className={`cursor-pointer border-b border-line last:border-0 hover:bg-sidebar/60 ${selectedId === j.id ? "bg-accent-soft/50" : ""} ${dead ? "text-faint" : ""}`}>
                      <td className="px-4 py-2.5">
                        <div className="font-medium">{j.customer}</div>
                        {j.quoteNumber && <div className="text-[11px] text-faint">#{j.quoteNumber}</div>}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{money(j.amount)}</td>
                      <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={j.status}
                          onChange={(e) => patch(j.id, statusPatch(j, e.target.value as JobStatus, today))}
                          className={`cursor-pointer rounded-full border-0 py-0.5 pl-2 pr-1 text-[12px] outline-none ${STATUS[j.status].cls}`}
                          aria-label="Status"
                        >
                          {(Object.keys(STATUS) as JobStatus[]).map((st) => <option key={st} value={st}>{STATUS[st].label}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-2.5 text-muted">{shortDate(j.sentDate)}</td>
                      <td className="px-3 py-2.5 text-muted">{shortDate(j.soldDate)}</td>
                      <td className="px-3 py-2.5 text-muted">{j.completedDate ? shortDate(j.completedDate) : j.scheduledDate ? <span className="text-faint">~{shortDate(j.scheduledDate)}</span> : ""}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{dead ? "–" : money(jobCommission(j, s), true)}</td>
                      <td className="px-4 py-2.5 text-muted">{pay ? `${j.status === "sold" ? "~" : ""}Early ${monthLabel(pay, { month: "short" })}` : j.status === "sold" ? "When done" : ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[12px] text-faint">
            Estimates use {s.rate}% of gross profit with job costs at {s.costPct}% of price until you enter the actual cost. Change the defaults under Manage businesses.
          </p>
        </section>
      </div>

      {selected && (
        <aside className="fixed inset-y-0 right-0 z-30 flex w-[360px] max-w-full flex-col border-l border-line bg-surface shadow-2xl">
          <JobEditor
            job={selected}
            settings={s}
            today={today}
            onChange={(p) => patch(selected.id, p)}
            onDelete={async () => {
              if (!confirm(`Delete ${selected.customer}?`)) return;
              setJobs((js) => js.filter((j) => j.id !== selected.id));
              setSelectedId(null);
              await fetch(`/api/jobs/${selected.id}`, { method: "DELETE" });
            }}
            onClose={() => setSelectedId(null)}
          />
        </aside>
      )}
    </div>
  );
}

function PayRow({ label, note, p }: { label: string; note?: string; p: { commission: number; bonus: number; jobs: Job[] } }) {
  return (
    <div className="flex items-center justify-between py-2.5 text-[14px]">
      <div>
        <div>{label}</div>
        <div className="text-[12px] text-muted">
          {p.jobs.length} job{p.jobs.length === 1 ? "" : "s"}
          {p.bonus ? ` + ${money(p.bonus)} monthly bonus` : ""}
          {note ? ` · ${note}` : ""}
        </div>
      </div>
      <span className="font-semibold tabular-nums">{money(p.commission + p.bonus)}</span>
    </div>
  );
}
