import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { Business } from "./types";
import { getKV, setKV } from "./store";

const SEED = path.join(process.cwd(), "data", "businesses.json");
const KEY = "businesses";

/** Validated categorical palette, assigned in this fixed order to new businesses. */
export const BUSINESS_COLORS = ["#eb6834", "#2a78d6", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"];

/** Businesses live in the database (editable in the app); data/businesses.json is only the starting point. */
/** Placeholder taglines from the first version, cleared once so only Scott's own text shows. */
const DEMO_TAGLINES = new Set(["Live Q&A platform", "Show & studio", "Home goods store", "Tanning products"]);
const CLEANED = "cleanup:demo-taglines-v1";

export async function getBusinesses(): Promise<Business[]> {
  const saved = await getKV<Business[]>(KEY);
  if (saved && !(await getKV<boolean>(CLEANED))) {
    const next = saved.map((b) => ({
      ...b,
      tagline: b.tagline && DEMO_TAGLINES.has(b.tagline) ? "" : b.tagline,
      name: b.id === "littletan" && b.name === "Little Tan" ? "Little Tandem" : b.name,
    }));
    await setKV(KEY, next);
    await setKV(CLEANED, true);
    return next;
  }
  if (saved) return saved;
  return JSON.parse(fs.readFileSync(SEED, "utf8")) as Business[];
}

export async function getBusiness(id: string): Promise<Business | undefined> {
  return (await getBusinesses()).find((b) => b.id === id);
}

export async function saveBusinesses(list: Business[]) {
  await setKV(KEY, list);
}

export function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 32) || "business";
}

/** Env-var friendly key, e.g. "Home Love" -> "HOMELOVE". */
export function envKey(name: string) {
  return name.toUpperCase().replace(/[^A-Z0-9]+/g, "").slice(0, 32) || "BUSINESS";
}
