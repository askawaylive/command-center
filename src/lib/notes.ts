import "server-only";
import { getKV, listKV, setKV } from "./store";

export interface DayNote {
  date: string; // YYYY-MM-DD
  html: string;
  tags: string[];
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const isDate = (d: string) => DATE_RE.test(d);

export function cleanTags(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out = v
    .filter((t): t is string => typeof t === "string")
    .map((t) => t.trim().replace(/^#/, "").toLowerCase().slice(0, 40))
    .filter(Boolean);
  return [...new Set(out)].slice(0, 30);
}

export async function getNote(date: string): Promise<DayNote> {
  const [html, tags] = await Promise.all([getKV<string>(`notes:${date}`), getKV<string[]>(`notetags:${date}`)]);
  return { date, html: html ?? "", tags: tags ?? [] };
}

export async function saveNote(date: string, patch: { html?: unknown; tags?: unknown }) {
  if (typeof patch.html === "string") await setKV(`notes:${date}`, patch.html.slice(0, 200_000));
  if (patch.tags !== undefined) await setKV(`notetags:${date}`, cleanTags(patch.tags));
}

/** Every day that has notes, newest first. */
export async function listNotes(): Promise<DayNote[]> {
  const [texts, tags] = await Promise.all([listKV<string>("notes:"), listKV<string[]>("notetags:")]);
  const tagMap = new Map(tags.map((t) => [t.key.slice("notetags:".length), t.value ?? []]));
  return texts
    .map((t) => ({ date: t.key.slice("notes:".length), html: typeof t.value === "string" ? t.value : "", tags: tagMap.get(t.key.slice("notes:".length)) ?? [] }))
    .filter((n) => isDate(n.date) && n.html.replace(/<[^>]*>/g, "").trim())
    .sort((a, b) => b.date.localeCompare(a.date));
}
