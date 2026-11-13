import "server-only";
import type { BankAccount, Business, BusinessMetrics, Email, RevenueStream, DailyPoint } from "./types";
import { getBusinesses } from "./businesses";
import { cached } from "./cache";
import { mockStream, mockEmails, mockDaily } from "./mock";
import { fetchStripe, stripeKey } from "./integrations/stripe";
import { fetchShopify, shopifyCreds } from "./integrations/shopify";
import { fetchMercuryAccounts, mockBankAccounts } from "./integrations/mercury";
import { fetchGmail, gmailRefreshToken } from "./integrations/gmail";
import { lastNDays } from "./dates";

export interface SourceStatus {
  name: string;
  kind: "stripe" | "shopify" | "mercury" | "gmail" | "claude";
  businessId?: string;
  connected: boolean;
  error?: string;
}

const errors = new Map<string, string>();

function mergeDaily(series: DailyPoint[][]): DailyPoint[] {
  const days = lastNDays(30);
  const totals = new Map(days.map((d) => [d, 0]));
  for (const s of series) for (const p of s) if (totals.has(p.date)) totals.set(p.date, totals.get(p.date)! + p.revenue);
  return days.map((date) => ({ date, revenue: Math.round(totals.get(date)! * 100) / 100 }));
}

export function getBankAccounts(): Promise<BankAccount[]> {
  return cached("mercury", async () => {
    const businesses = await getBusinesses();
    try {
      errors.delete("mercury");
      return await fetchMercuryAccounts(businesses);
    } catch (e) {
      errors.set("mercury", String(e));
      return mockBankAccounts(businesses);
    }
  });
}

async function metricsFor(b: Business, accounts: BankAccount[]): Promise<BusinessMetrics> {
  const streams: RevenueStream[] = [];
  const series: DailyPoint[][] = [];
  let revenuePrev30d = 0;

  for (const acct of b.sources.stripe ?? []) {
    const key = `stripe:${acct}`;
    if (stripeKey(acct)) {
      try {
        const r = await cached(key, () => fetchStripe(acct));
        errors.delete(key);
        streams.push({ source: "stripe", account: acct, revenue30d: r.revenue30d, orders30d: r.orders30d, mrr: r.mrr, live: true });
        series.push(r.daily);
        revenuePrev30d += r.revenuePrev30d;
        continue;
      } catch (e) {
        errors.set(key, String(e));
      }
    }
    const m = mockStream(b, "stripe", acct);
    streams.push(m);
    series.push(scaleDaily(mockDaily(b.id + acct).slice(-30), m.revenue30d));
    revenuePrev30d += m.revenue30d * 0.88;
  }

  for (const acct of b.sources.shopify ?? []) {
    const key = `shopify:${acct}`;
    if (shopifyCreds(acct)) {
      try {
        const r = await cached(key, () => fetchShopify(acct));
        errors.delete(key);
        streams.push({ source: "shopify", account: acct, revenue30d: r.revenue30d, orders30d: r.orders30d, live: true });
        series.push(r.daily);
        revenuePrev30d += r.revenuePrev30d;
        continue;
      } catch (e) {
        errors.set(key, String(e));
      }
    }
    const m = mockStream(b, "shopify", acct);
    streams.push(m);
    series.push(scaleDaily(mockDaily(b.id + acct).slice(-30), m.revenue30d));
    revenuePrev30d += m.revenue30d * 0.85;
  }

  // No revenue sources configured: show zeros rather than made-up numbers.

  const daily = mergeDaily(series);
  const cash = accounts.filter((a) => a.businessId === b.id).reduce((s, a) => s + a.balance, 0);
  return {
    businessId: b.id,
    revenue30d: daily.reduce((s, d) => s + d.revenue, 0),
    revenuePrev30d: Math.round(revenuePrev30d),
    orders30d: streams.reduce((s, x) => s + x.orders30d, 0),
    mrr: Math.round(streams.reduce((s, x) => s + (x.mrr ?? 0), 0)),
    cash,
    daily,
    streams,
    live: streams.some((s) => s.live) || accounts.some((a) => a.businessId === b.id && a.live),
  };
}

function scaleDaily(daily: DailyPoint[], total: number): DailyPoint[] {
  const sum = daily.reduce((s, d) => s + d.revenue, 0) || 1;
  return daily.map((d) => ({ date: d.date, revenue: Math.round((d.revenue / sum) * total) }));
}

export async function getAllMetrics(): Promise<BusinessMetrics[]> {
  const accounts = await getBankAccounts();
  return Promise.all((await getBusinesses()).map((b) => metricsFor(b, accounts)));
}

export async function getMetrics(businessId: string) {
  return (await getAllMetrics()).find((m) => m.businessId === businessId);
}

export async function getEmails(businessId?: string): Promise<Email[]> {
  const businesses = (await getBusinesses()).filter((b) => !businessId || b.id === businessId);
  const lists = await Promise.all(
    businesses.map(async (b) => {
      const acct = b.sources.gmail?.account;
      const key = `gmail:${acct}`;
      if (acct && (await gmailRefreshToken(acct))) {
        try {
          const r = await cached(key, () => fetchGmail(b), 60_000);
          errors.delete(key);
          return r;
        } catch (e) {
          errors.set(key, String(e));
        }
      }
      return acct ? mockEmails(b) : [];
    }),
  );
  return lists.flat().sort((a, b) => b.date.localeCompare(a.date));
}

export async function getSourceStatus(): Promise<SourceStatus[]> {
  const out: SourceStatus[] = [
    { name: "Claude (AI agent)", kind: "claude", connected: Boolean(process.env.ANTHROPIC_API_KEY) },
    { name: "Mercury", kind: "mercury", connected: Boolean(process.env.MERCURY_API_TOKEN), error: errors.get("mercury") },
  ];
  for (const b of await getBusinesses()) {
    for (const a of b.sources.stripe ?? [])
      out.push({ name: `Stripe · ${a}`, kind: "stripe", businessId: b.id, connected: Boolean(stripeKey(a)), error: errors.get(`stripe:${a}`) });
    for (const a of b.sources.shopify ?? [])
      out.push({ name: `Shopify · ${a}`, kind: "shopify", businessId: b.id, connected: Boolean(shopifyCreds(a)), error: errors.get(`shopify:${a}`) });
    const g = b.sources.gmail?.account;
    if (g) out.push({ name: `Gmail · ${g}`, kind: "gmail", businessId: b.id, connected: Boolean(await gmailRefreshToken(g)), error: errors.get(`gmail:${g}`) });
  }
  return out;
}
