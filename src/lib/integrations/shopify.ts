import type { DailyPoint } from "../types";
import { isoDay, DAY } from "../dates";

const API_VERSION = "2025-10";

export function shopifyCreds(account: string) {
  const store = process.env[`SHOPIFY_${account}_STORE`];
  const token = process.env[`SHOPIFY_${account}_TOKEN`];
  if (!store || !token || store.startsWith("your-store")) return undefined;
  return { store, token };
}

interface OrdersPage {
  data?: {
    orders: {
      edges: { node: { createdAt: string; cancelledAt: string | null; totalPriceSet: { shopMoney: { amount: string } } } }[];
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
    };
  };
  errors?: unknown;
}

/** Order revenue over the last 60 days from the Shopify Admin GraphQL API. */
export async function fetchShopify(account: string) {
  const creds = shopifyCreds(account);
  if (!creds) throw new Error(`No Shopify credentials for ${account}`);
  const since = new Date(Date.now() - 60 * DAY).toISOString();
  const cutoff = Date.now() - 30 * DAY;

  const byDay = new Map<string, number>();
  let revenue30d = 0;
  let revenuePrev30d = 0;
  let orders30d = 0;
  let after: string | null = null;

  for (let page = 0; page < 40; page++) {
    const res = await fetch(`https://${creds.store}/admin/api/${API_VERSION}/graphql.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": creds.token },
      body: JSON.stringify({
        query: `query($q: String!, $after: String) {
          orders(first: 250, query: $q, after: $after) {
            edges { node { createdAt cancelledAt totalPriceSet { shopMoney { amount } } } }
            pageInfo { hasNextPage endCursor }
          }
        }`,
        variables: { q: `created_at:>=${since}`, after },
      }),
    });
    const json = (await res.json()) as OrdersPage;
    if (!res.ok || json.errors || !json.data) throw new Error(`Shopify ${account}: ${res.status} ${JSON.stringify(json.errors ?? "")}`);
    for (const { node } of json.data.orders.edges) {
      if (node.cancelledAt) continue;
      const amount = Number(node.totalPriceSet.shopMoney.amount);
      const ms = Date.parse(node.createdAt);
      if (ms >= cutoff) {
        revenue30d += amount;
        orders30d += 1;
        const d = isoDay(ms);
        byDay.set(d, (byDay.get(d) ?? 0) + amount);
      } else revenuePrev30d += amount;
    }
    if (!json.data.orders.pageInfo.hasNextPage) break;
    after = json.data.orders.pageInfo.endCursor;
  }

  const daily: DailyPoint[] = [...byDay.entries()].map(([date, revenue]) => ({ date, revenue }));
  return { revenue30d, revenuePrev30d, orders30d, daily };
}
