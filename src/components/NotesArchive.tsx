"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Business } from "@/lib/types";
import { isoDay } from "@/lib/dates";
import { BizMark } from "./BizMark";
import { Icon } from "./Icon";
import { RichNote } from "./RichNote";

export interface DayNote {
  date: string;
  html: string;
  tags: string[];
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", nbsp: " " };
function plain(html: string) {
  return html
    .replace(/<\/(p|li|h[1-6]|blockquote)>/g, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (_, e) => ENTITIES[e])
    .replace(/\n{2,}/g, "\n")
    .trim();
}
const hashtags = (text: string) => [...new Set([...text.matchAll(/(^|\s)#([\p{L}\p{N}_-]{2,40})/gu)].map((m) => m[2].toLowerCase()))];
const fmt = (iso: string, o: Intl.DateTimeFormatOptions) => new Date(iso + "T00:00").toLocaleDateString(undefined, o);

function TagEditor({ tags, onChange }: { tags: string[]; onChange: (t: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const t = draft.trim().replace(/^#/, "").toLowerCase();
    if (t && !tags.includes(t)) onChange([...tags, t]);
    setDraft("");
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tags.map((t) => (
        <span key={t} className="inline-flex items-center gap-1 rounded-full bg-accent-soft py-0.5 pl-2.5 pr-1 text-[12px] text-accent">
          #{t}
          <button onClick={() => onChange(tags.filter((x) => x !== t))} aria-label={`Remove tag ${t}`} className="rounded-full p-0.5 hover:bg-accent/15">
            <Icon name="x" size={11} />
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add();
          }
          if (e.key === "Backspace" && !draft && tags.length) onChange(tags.slice(0, -1));
        }}
        onBlur={add}
        placeholder={tags.length ? "Add tag" : "Add a tag, press Enter"}
        className="min-w-[120px] flex-1 bg-transparent py-0.5 text-[13px] outline-none placeholder:text-faint"
      />
    </div>
  );
}

export function NotesArchive({ initial, businesses }: { initial: DayNote[]; businesses: Business[] }) {
  const [notes, setNotes] = useState(initial);
  const [today, setToday] = useState(() => isoDay());
  const [q, setQ] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"" | "saving" | "saved" | "error">("");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => setToday(isoDay()), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSelected(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // A day's notes are filed here once the day is over (after midnight, local time).
  const enriched = useMemo(
    () =>
      notes
        .filter((n) => n.date < today)
        .map((n) => {
          const text = plain(n.html);
          const lower = text.toLowerCase();
          const biz = businesses.filter((b) => lower.includes(b.name.toLowerCase()));
          const auto = hashtags(text);
          return { ...n, text, biz, allTags: [...new Set([...n.tags, ...auto])] };
        }),
    [notes, today, businesses],
  );

  const tagCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const n of enriched) {
      for (const t of n.allTags) m.set(`#${t}`, (m.get(`#${t}`) ?? 0) + 1);
      for (const b of n.biz) m.set(`biz:${b.id}`, (m.get(`biz:${b.id}`) ?? 0) + 1);
    }
    return m;
  }, [enriched]);

  const needle = q.trim().toLowerCase();
  const visible = enriched.filter((n) => {
    if (tag?.startsWith("#") && !n.allTags.includes(tag.slice(1))) return false;
    if (tag?.startsWith("biz:") && !n.biz.some((b) => `biz:${b.id}` === tag)) return false;
    if (!needle) return true;
    return n.text.toLowerCase().includes(needle) || n.allTags.some((t) => t.includes(needle.replace(/^#/, ""))) || fmt(n.date, { month: "long", weekday: "long" }).toLowerCase().includes(needle);
  });

  const months = new Map<string, typeof visible>();
  for (const n of visible) {
    const k = n.date.slice(0, 7);
    months.set(k, [...(months.get(k) ?? []), n]);
  }

  const current = notes.find((n) => n.date === selected);

  const persist = (date: string, body: { text?: string; tags?: string[] }) => {
    setSaveState("saving");
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const r = await fetch(`/api/notes/${date}`, { method: "PUT", body: JSON.stringify(body) }).catch(() => null);
      setSaveState(r?.ok ? "saved" : "error");
    }, 500);
  };
  const updateNote = (date: string, patch: Partial<DayNote>) => setNotes((ns) => ns.map((n) => (n.date === date ? { ...n, ...patch } : n)));

  const snippet = (text: string) => {
    if (!needle) return text.slice(0, 220);
    const at = text.toLowerCase().indexOf(needle);
    if (at < 0) return text.slice(0, 220);
    const start = Math.max(0, at - 60);
    return (start ? "…" : "") + text.slice(start, start + 220);
  };
  const highlight = (s: string) => {
    if (!needle) return s;
    const parts = s.split(new RegExp(`(${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "ig"));
    return parts.map((p, i) => (p.toLowerCase() === needle ? <mark key={i} className="rounded bg-accent-soft px-0.5 text-ink">{p}</mark> : p));
  };

  const chip = (active: boolean) =>
    `inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] border transition-colors ${active ? "bg-ink text-bg border-ink" : "border-line text-muted hover:text-ink"}`;
  const bizTags = businesses.filter((b) => tagCounts.has(`biz:${b.id}`));
  const hashTags = [...tagCounts.entries()].filter(([k]) => k.startsWith("#")).sort((a, b) => b[1] - a[1]);

  return (
    <div className="flex h-full">
      <div className="min-w-0 flex-1 overflow-y-auto scroll-thin px-8 pt-8 pb-10">
        <h1 className="text-[32px] leading-tight">Notes</h1>
        <p className="mt-1 text-[15px] text-muted">Each day&apos;s notes from Today are filed here after midnight.</p>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <div className="relative mr-2 w-full sm:w-72">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint"><Icon name="search" size={14} /></span>
            <input className="input !rounded-full !py-1.5 !pl-8" placeholder="Search notes" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          {(bizTags.length > 0 || hashTags.length > 0) && (
            <button className={chip(tag === null)} onClick={() => setTag(null)}>All</button>
          )}
          {bizTags.map((b) => (
            <button key={b.id} className={`${chip(tag === `biz:${b.id}`)} !pl-1.5`} onClick={() => setTag(tag === `biz:${b.id}` ? null : `biz:${b.id}`)}>
              <BizMark business={b} size={18} /> {b.name}
            </button>
          ))}
          {hashTags.map(([k, c]) => (
            <button key={k} className={chip(tag === k)} onClick={() => setTag(tag === k ? null : k)}>
              {k} <span className="text-[11px] opacity-60">{c}</span>
            </button>
          ))}
        </div>

        {enriched.length === 0 ? (
          <div className="mt-16 text-center">
            <span className="text-faint"><Icon name="note" size={30} /></span>
            <p className="mt-3 text-muted">No past notes yet. Write in the Notes box on Today and it shows up here the next day.</p>
          </div>
        ) : visible.length === 0 ? (
          <p className="mt-10 text-center text-muted">No notes match.</p>
        ) : (
          [...months.entries()].map(([m, list]) => (
            <section key={m} className="mt-8">
              <h2 className="mb-3 text-[13px] font-medium uppercase tracking-wider text-faint">{fmt(m + "-01", { month: "long", year: "numeric" })}</h2>
              <div className="flex flex-col gap-2">
                {list.map((n) => (
                  <button
                    key={n.date}
                    onClick={() => setSelected(n.date)}
                    className={`card flex gap-4 p-4 text-left transition-shadow hover:shadow-[0_2px_10px_rgba(0,0,0,0.06)] ${selected === n.date ? "!border-accent ring-1 ring-accent" : ""}`}
                  >
                    <div className="w-14 shrink-0 text-center">
                      <div className="text-[11px] uppercase tracking-wide text-muted">{fmt(n.date, { weekday: "short" })}</div>
                      <div className="text-[24px] font-semibold leading-tight tabular-nums">{fmt(n.date, { day: "numeric" })}</div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-3 whitespace-pre-line text-[14px] leading-relaxed">{highlight(snippet(n.text))}</p>
                      {(n.biz.length > 0 || n.allTags.length > 0) && (
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          {n.biz.map((b) => <span key={b.id} title={b.name}><BizMark business={b} size={18} /></span>)}
                          {n.allTags.map((t) => (
                            <span key={t} className="rounded-full bg-sidebar px-2 py-0.5 text-[12px] text-muted">#{t}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </section>
          ))
        )}
      </div>

      {current && (
        <aside className="fixed inset-y-0 right-0 z-30 flex w-[420px] max-w-full flex-col border-l border-line bg-surface shadow-2xl lg:static lg:shadow-none">
          <div className="flex items-center gap-2 border-b border-line px-4 py-3">
            <div>
              <div className="text-[15px] font-semibold">{fmt(current.date, { weekday: "long", month: "long", day: "numeric" })}</div>
              <div className="text-[12px] text-faint">{fmt(current.date, { year: "numeric" })}</div>
            </div>
            <span className="ml-auto text-[12px] text-faint">{saveState === "saving" ? "Saving…" : saveState === "error" ? "Couldn't save" : saveState === "saved" ? "Saved" : ""}</span>
            <button onClick={() => setSelected(null)} aria-label="Close" className="rounded-md p-1.5 text-faint hover:bg-sidebar hover:text-ink">
              <Icon name="x" size={15} />
            </button>
          </div>
          <div className="border-b border-line px-4 py-2.5">
            <div className="flex items-start gap-2">
              <span className="mt-1 text-faint"><Icon name="tag" size={14} /></span>
              <TagEditor
                tags={current.tags}
                onChange={(tags) => {
                  updateNote(current.date, { tags });
                  persist(current.date, { tags });
                }}
              />
            </div>
          </div>
          <div className="min-h-0 flex-1 p-4 pb-24">
            <RichNote
              key={current.date}
              initial={current.html}
              onChange={(html) => {
                updateNote(current.date, { html });
                persist(current.date, { text: html });
              }}
            />
          </div>
        </aside>
      )}
    </div>
  );
}
