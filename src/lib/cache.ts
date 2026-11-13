const store = new Map<string, { at: number; value: unknown }>();
const inflight = new Map<string, Promise<unknown>>();
const TTL_MS = 5 * 60 * 1000;

/**
 * In-memory cache with stale-while-revalidate: once something has loaded, pages always get
 * the last value straight away, and an expired value is refreshed in the background
 * instead of making the page wait on Stripe, Shopify, Mercury or Gmail.
 */
export async function cached<T>(key: string, fn: () => Promise<T>, ttl = TTL_MS): Promise<T> {
  const hit = store.get(key);
  const refresh = () => {
    let p = inflight.get(key) as Promise<T> | undefined;
    if (!p) {
      p = fn()
        .then((value) => {
          store.set(key, { at: Date.now(), value });
          return value;
        })
        .finally(() => inflight.delete(key));
      inflight.set(key, p);
    }
    return p;
  };
  if (!hit) return refresh();
  if (Date.now() - hit.at >= ttl) refresh().catch(() => {}); // keep showing the old value if the refresh fails
  return hit.value as T;
}

export function clearCache() {
  store.clear();
}
