const store = new Map<string, { at: number; value: unknown }>();
const TTL_MS = 5 * 60 * 1000;

/** Tiny in-memory cache so the dashboard doesn't hammer Stripe/Shopify/Mercury on every page load. */
export async function cached<T>(key: string, fn: () => Promise<T>, ttl = TTL_MS): Promise<T> {
  const hit = store.get(key);
  if (hit && Date.now() - hit.at < ttl) return hit.value as T;
  const value = await fn();
  store.set(key, { at: Date.now(), value });
  return value;
}

export function clearCache() {
  store.clear();
}
