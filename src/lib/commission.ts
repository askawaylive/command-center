/** Paint & Co style commission math. Pure functions, safe on server and client. */
import type { Business, Job } from "./types";

export const DEFAULT_COMMISSION = { rate: 13, costPct: 40 };

export function isCommission(b: Pick<Business, "model" | "name">) {
  return b.model === "commission" || (b.model === undefined && /paint\s*(&|and)?\s*co/i.test(b.name));
}
export function commissionSettings(b: Pick<Business, "commission">) {
  return { ...DEFAULT_COMMISSION, ...(b.commission ?? {}) };
}

export const monthOf = (iso?: string) => (iso ? iso.slice(0, 7) : undefined); // YYYY-MM
export function nextMonth(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}
export const monthLabel = (ym: string, opts: Intl.DateTimeFormatOptions = { month: "long", year: "numeric" }) =>
  new Date(ym + "-01T00:00").toLocaleDateString(undefined, opts);

export function jobCost(j: Job, costPct: number) {
  return j.actualCost ?? (j.amount * (j.costPct ?? costPct)) / 100;
}
export function jobProfit(j: Job, costPct: number) {
  return j.amount - jobCost(j, costPct);
}
export function jobCommission(j: Job, s: { rate: number; costPct: number }) {
  return Math.max(0, (jobProfit(j, s.costPct) * s.rate) / 100);
}
const isSale = (j: Job) => !!j.soldDate && (j.status === "sold" || j.status === "completed");

/** Monthly sales bonus: needs ≥45% margin; $500 at $100k, +$500 per further full $25k. */
export function monthlyBonus(volume: number, margin: number) {
  if (volume < 100_000 || margin < 0.45) return 0;
  return 500 + 500 * Math.floor((volume - 100_000) / 25_000);
}
export function nextMonthlyTier(volume: number) {
  return volume < 100_000 ? 100_000 : 100_000 + 25_000 * (Math.floor((volume - 100_000) / 25_000) + 1);
}
const ANNUAL = [
  [2_000_000, 12_000],
  [1_750_000, 8_750],
  [1_500_000, 6_000],
  [1_250_000, 3_750],
] as const;
export function annualBonus(volume: number) {
  return ANNUAL.find(([t]) => volume >= t)?.[1] ?? 0;
}
export function nextAnnualTier(volume: number) {
  return [...ANNUAL].reverse().find(([t]) => volume < t) ?? null;
}

export function salesInMonth(jobs: Job[], ym: string, costPct: number) {
  const sold = jobs.filter((j) => isSale(j) && monthOf(j.soldDate) === ym);
  const volume = sold.reduce((t, j) => t + j.amount, 0);
  const profit = sold.reduce((t, j) => t + jobProfit(j, costPct), 0);
  return { jobs: sold, volume, margin: volume ? profit / volume : 0 };
}
export function salesInYear(jobs: Job[], year: string) {
  return jobs.filter((j) => isSale(j) && j.soldDate!.startsWith(year)).reduce((t, j) => t + j.amount, 0);
}

/** Proposals issued in the last 90 days vs. how many were accepted. */
export function winRate(jobs: Job[], today: string) {
  const from = new Date(today + "T00:00");
  from.setDate(from.getDate() - 90);
  const since = from.toISOString().slice(0, 10);
  const issued = jobs.filter((j) => j.sentDate >= since && j.sentDate <= today);
  const won = issued.filter((j) => !!j.soldDate || j.status === "sold" || j.status === "completed");
  return { issued: issued.length, won: won.length, rate: issued.length ? won.length / issued.length : null };
}

export interface Payout {
  month: string; // YYYY-MM when it is paid (first pay cycle of that month)
  commission: number;
  bonus: number;
  jobs: Job[];
  expected: boolean; // true when based on scheduled (not actual) completion
}

/**
 * Commission is paid the month after the job is completed; the monthly bonus the month after the sale month.
 * Jobs sold but not done yet are placed by their scheduled completion date when there is one.
 */
export function payouts(jobs: Job[], s: { rate: number; costPct: number }) {
  const map = new Map<string, Payout>();
  const get = (m: string) => {
    if (!map.has(m)) map.set(m, { month: m, commission: 0, bonus: 0, jobs: [], expected: false });
    return map.get(m)!;
  };
  const unscheduled: Job[] = [];
  for (const j of jobs) {
    if (j.status === "completed" && j.completedDate) {
      const p = get(nextMonth(monthOf(j.completedDate)!));
      p.commission += jobCommission(j, s);
      p.jobs.push(j);
    } else if (j.status === "sold") {
      if (j.scheduledDate) {
        const p = get(nextMonth(monthOf(j.scheduledDate)!));
        p.commission += jobCommission(j, s);
        p.jobs.push(j);
        p.expected = true;
      } else unscheduled.push(j);
    }
  }
  const saleMonths = new Set(jobs.filter(isSale).map((j) => monthOf(j.soldDate)!));
  for (const m of saleMonths) {
    const { volume, margin } = salesInMonth(jobs, m, s.costPct);
    const b = monthlyBonus(volume, margin);
    if (b) get(nextMonth(m)).bonus += b;
  }
  return { list: [...map.values()].sort((a, b) => a.month.localeCompare(b.month)), unscheduled };
}
