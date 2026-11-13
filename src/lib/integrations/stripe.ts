import Stripe from "stripe";
import type { DailyPoint } from "../types";
import { isoDay, DAY } from "../dates";

export function stripeKey(account: string) {
  return process.env[`STRIPE_${account}_SECRET_KEY`] || undefined;
}

export interface StripeResult {
  revenue30d: number;
  revenuePrev30d: number;
  orders30d: number;
  mrr: number;
  subscribers: number;
  daily: DailyPoint[];
}

/** Net succeeded charges over the last 60 days plus MRR from active subscriptions. Amounts in dollars. */
export async function fetchStripe(account: string): Promise<StripeResult> {
  const key = stripeKey(account);
  if (!key) throw new Error(`No Stripe key for ${account}`);
  const stripe = new Stripe(key);
  const since = Math.floor((Date.now() - 60 * DAY) / 1000);
  const cutoff = Date.now() - 30 * DAY;

  const byDay = new Map<string, number>();
  let revenue30d = 0;
  let revenuePrev30d = 0;
  let orders30d = 0;
  for await (const ch of stripe.charges.list({ created: { gte: since }, limit: 100 })) {
    if (ch.status !== "succeeded" || !ch.paid) continue;
    const amount = (ch.amount_captured - ch.amount_refunded) / 100;
    const ms = ch.created * 1000;
    if (ms >= cutoff) {
      revenue30d += amount;
      orders30d += 1;
      const d = isoDay(ms);
      byDay.set(d, (byDay.get(d) ?? 0) + amount);
    } else {
      revenuePrev30d += amount;
    }
  }

  let mrr = 0;
  let subscribers = 0;
  for await (const sub of stripe.subscriptions.list({ status: "active", limit: 100 })) {
    subscribers += 1;
    for (const item of sub.items.data) {
      const price = item.price;
      const unit = (price.unit_amount ?? 0) / 100;
      const qty = item.quantity ?? 1;
      const interval = price.recurring?.interval;
      const count = price.recurring?.interval_count ?? 1;
      const perMonth =
        interval === "year" ? unit / (12 * count)
        : interval === "week" ? (unit * 52) / (12 * count)
        : interval === "day" ? (unit * 365) / (12 * count)
        : unit / count;
      mrr += perMonth * qty;
    }
  }

  const daily = [...byDay.entries()].map(([date, revenue]) => ({ date, revenue }));
  return { revenue30d, revenuePrev30d, orders30d, mrr, subscribers, daily };
}
