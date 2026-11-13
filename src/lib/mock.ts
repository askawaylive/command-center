import type { Business, BusinessMetrics, Email, RevenueStream } from "./types";
import { lastNDays, DAY } from "./dates";

/** Deterministic pseudo-random so mock numbers don't jump around between reloads. */
function seeded(seed: string) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

const SCALE: Record<string, number> = { askaway: 1400, sitcom: 650, homelove: 2100, littletan: 1750 };

export function mockDaily(businessId: string, days = 60) {
  const rand = seeded(businessId);
  const base = SCALE[Object.keys(SCALE).find((k) => businessId.startsWith(k)) ?? ""] ?? 800;
  return lastNDays(days).map((date, i) => {
    const trend = 0.8 + (i / days) * 0.45;
    const weekday = new Date(date).getDay();
    const weekend = weekday === 0 || weekday === 6 ? 0.75 : 1;
    return { date, revenue: Math.round(base * trend * weekend * (0.6 + rand() * 0.8)) };
  });
}

export function mockStream(b: Business, source: "stripe" | "shopify", account: string): RevenueStream {
  const daily = mockDaily(b.id + account).slice(-30);
  const share = source === "shopify" ? 1 : b.sources.shopify?.length ? 0.25 : 1;
  const revenue30d = Math.round(daily.reduce((s, d) => s + d.revenue, 0) * share);
  return {
    source,
    account,
    revenue30d,
    orders30d: Math.round(revenue30d / (source === "shopify" ? 58 : 42)),
    mrr: source === "stripe" ? Math.round(revenue30d * 0.62) : undefined,
    subscribers: source === "stripe" ? Math.round((revenue30d * 0.62) / 11.99) : undefined,
    live: false,
  };
}

export function mockMetrics(b: Business): Omit<BusinessMetrics, "streams" | "cash" | "live"> {
  const daily = mockDaily(b.id);
  const last30 = daily.slice(-30);
  const prev30 = daily.slice(0, 30);
  const revenue30d = last30.reduce((s, d) => s + d.revenue, 0);
  return {
    businessId: b.id,
    revenue30d,
    revenuePrev30d: prev30.reduce((s, d) => s + d.revenue, 0),
    orders30d: Math.round(revenue30d / 50),
    mrr: 0,
    subscribers: 0,
    daily: last30,
  };
}

export function mockCash(businessId: string) {
  const rand = seeded("cash" + businessId);
  return Math.round(18000 + rand() * 90000);
}

const SENDERS: Record<string, [string, string, string][]> = {
  askaway: [
    ["Stripe", "Your payout of $4,218.40 is on the way", "Funds should arrive in your Mercury account within 2 business days."],
    ["Jordan (Creator)", "Can we move Thursday's live session?", "Hey! Something came up on my end, any chance we can push to Friday 7pm?"],
    ["App Store Connect", "Askaway 2.3 is Ready for Sale", "The status of your app has changed to Ready for Sale."],
    ["Priya, Growth Advisor", "Launch checklist feedback", "Went through the doc. Two things I'd change before the press push..."],
  ],
  sitcom: [
    ["Casting Desk", "Callback list for episode 4", "Attached is the shortlist. We need sign-off by Monday."],
    ["Venue Booking", "Hold confirmed for Dec 6", "Your hold on the main stage is confirmed. Deposit invoice attached."],
    ["Editor", "Rough cut ready for review", "Link inside. About 22 minutes, notes welcome."],
  ],
  homelove: [
    ["Shopify", "You have 12 new orders", "Here's a summary of yesterday's orders for Home Love."],
    ["Supplier, Lina", "Restock ETA for linen throws", "Production finishes next week; we can ship by the 24th."],
    ["Customer: Maya R.", "Question about my order #1043", "Hi, I ordered the ceramic set last week and haven't seen tracking yet."],
    ["Meta Ads", "Your campaign is performing above average", "Holiday Gift Guide is beating benchmark CTR by 38%."],
  ],
  littletan: [
    ["Shopify", "Inventory alert: Glow Drops low", "Glow Drops (30ml) has 14 units left across locations."],
    ["Influencer, Kai", "Content drafts for the winter drop", "Three TikToks attached, let me know which one you like best."],
    ["3PL Warehouse", "Weekly fulfillment report", "98.7% shipped same day. 2 exceptions noted."],
  ],
};

export function mockEmails(b: Business): Email[] {
  const rows = SENDERS[b.id] ?? [["Team", `Weekly update for ${b.name}`, "Here's where things stand this week."]];
  const now = Date.now();
  return rows.map(([from, subject, snippet], i) => ({
    id: `${b.id}-mock-${i}`,
    businessId: b.id,
    from,
    subject,
    snippet,
    date: new Date(now - (i * 5 + 1) * 3_600_000 - i * DAY * 0.3).toISOString(),
    unread: i < 2,
    live: false,
  }));
}
