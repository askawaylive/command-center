"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Business, Task } from "@/lib/types";
import { addDays, isoDay } from "@/lib/dates";
import { TaskCard } from "./TaskCard";
import { AddTask } from "./AddTask";
import { useTasks, fmtMinutes } from "./useTasks";
import { Icon } from "./Icon";
import { BizMark } from "./BizMark";
import { TaskDetails } from "./TaskDetails";

const WORKDAY_MIN = 6 * 60;

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

const fmtDay = (iso: string, opts: Intl.DateTimeFormatOptions) => new Date(iso + "T00:00").toLocaleDateString(undefined, opts);

/** Quick notes for one day, saved automatically as you type. */
function DayNotes({ day }: { day: string }) {
  const [text, setText] = useState("");
  const [state, setState] = useState<"loading" | "saved" | "saving" | "error">("loading");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    let live = true;
    setState("loading");
    fetch(`/api/notes/${day}`)
      .then((r) => r.json())
      .then((d: { text?: string }) => {
        if (!live) return;
        setText(d.text ?? "");
        setState("saved");
      })
      .catch(() => live && setState("error"));
    return () => {
      live = false;
    };
  }, [day]);

  const save = (value: string) => {
    setText(value);
    setState("saving");
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const r = await fetch(`/api/notes/${day}`, { method: "PUT", body: JSON.stringify({ text: value }) }).catch(() => null);
      setState(r?.ok ? "saved" : "error");
    }, 600);
  };

  return (
    <section className="card flex flex-col p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-[16px]">Notes</h2>
        <span className="text-[12px] text-faint">
          {state === "saving" ? "Saving…" : state === "error" ? "Couldn't save" : state === "saved" && text ? "Saved" : ""}
        </span>
      </div>
      <textarea
        value={text}
        disabled={state === "loading"}
        onChange={(e) => save(e.target.value)}
        placeholder="Jot down anything from today: calls, numbers, ideas, who said what…"
        className="min-h-[260px] w-full flex-1 resize-y bg-transparent text-[14px] leading-relaxed outline-none placeholder:text-faint"
      />
    </section>
  );
}

export function Planner({ initialTasks, businesses, name }: { initialTasks: Task[]; businesses: Business[]; name?: string }) {
  const { tasks, update, create, remove } = useTasks(initialTasks);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [today, setToday] = useState(() => isoDay());
  const [day, setDay] = useState(today);
  const [showDone, setShowDone] = useState(false);
  const byId = useMemo(() => Object.fromEntries(businesses.map((b) => [b.id, b])), [businesses]);
  const selected = tasks.find((t) => t.id === selectedId);

  // Use the browser's own date (the server may sit in another time zone).
  useEffect(() => {
    const t = isoDay();
    setToday(t);
    setDay(t);
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSelectedId(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Unfinished tasks from past days roll forward into today.
  const plannedOn = (t: Task) => (t.plannedFor && t.plannedFor < today && t.status !== "done" ? today : t.plannedFor);
  const rank = (t: Task) => (t.status === "doing" ? 0 : t.priority === "high" ? 1 : 2);
  const dayTasks = tasks.filter((t) => plannedOn(t) === day);
  const open = dayTasks.filter((t) => t.status !== "done").sort((a, b) => rank(a) - rank(b));
  const done = dayTasks.filter((t) => t.status === "done");
  const planned = dayTasks.reduce((s, t) => s + (t.estimateMin ?? 0), 0);
  const left = open.reduce((s, t) => s + (t.estimateMin ?? 0), 0);
  const bizCount = new Set(dayTasks.map((t) => t.businessId)).size;
  const upcoming = tasks
    .filter((t) => t.status !== "done" && t.dueDate && t.dueDate > day && t.dueDate <= addDays(day, 7) && plannedOn(t) !== day)
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));

  const isToday = day === today;
  const toggle = (t: Task) => update(t.id, { status: t.status === "done" ? "todo" : "done" });
  const card = (t: Task) => (
    <TaskCard key={t.id} task={t} business={byId[t.businessId]} onToggle={() => toggle(t)} onOpen={() => setSelectedId(t.id)} selected={t.id === selectedId} />
  );

  return (
    <div className="flex h-full">
      <div className="min-w-0 flex-1 overflow-y-auto scroll-thin">
        <header className="px-8 pt-8 pb-6">
          <div className="flex items-center gap-1 text-[13px] text-muted">
            <button onClick={() => setDay(addDays(day, -1))} aria-label="Previous day" className="rounded-md p-1 hover:bg-sidebar hover:text-ink">
              <Icon name="chevronLeft" size={15} />
            </button>
            <span className="min-w-[180px] text-center">{fmtDay(day, { weekday: "long", month: "long", day: "numeric" })}</span>
            <button onClick={() => setDay(addDays(day, 1))} aria-label="Next day" className="rounded-md p-1 hover:bg-sidebar hover:text-ink">
              <Icon name="chevronRight" size={15} />
            </button>
            {!isToday && (
              <button onClick={() => setDay(today)} className="ml-2 rounded-full border border-line px-2.5 py-0.5 text-[12px] hover:text-ink">
                Back to today
              </button>
            )}
          </div>
          <h1 className="mt-2 text-[32px] leading-tight">
            {isToday ? `${greeting()}${name ? `, ${name}` : ""}` : fmtDay(day, { weekday: "long" })}
          </h1>
          <p className="mt-1 text-[15px] text-muted">
            {dayTasks.length === 0
              ? "Nothing planned yet. Add a task below."
              : `${done.length} of ${dayTasks.length} done across ${bizCount} ${bizCount === 1 ? "business" : "businesses"}. ${fmtMinutes(left)} of work left.`}
          </p>
          {dayTasks.length > 0 && (
            <div className="mt-4 flex max-w-xl items-center gap-3 text-[12px] text-muted">
              <Icon name="clock" size={13} />
              <span className="tabular-nums">{fmtMinutes(planned)} planned</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.min(100, (planned / WORKDAY_MIN) * 100)}%`, background: planned > WORKDAY_MIN ? "var(--bad)" : "var(--accent)" }}
                />
              </div>
            </div>
          )}
        </header>

        <div className="grid gap-6 px-8 pb-10 xl:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
          <section>
            <h2 className="mb-3 text-[16px]">Tasks</h2>
            <div className="flex flex-col gap-2">
              {open.map(card)}
              <AddTask businesses={businesses} defaults={{ plannedFor: day, status: "todo" }} onCreate={create} />
            </div>
            {done.length > 0 && (
              <div className="mt-4">
                <button onClick={() => setShowDone((s) => !s)} className="flex items-center gap-1.5 px-1 text-[13px] text-muted hover:text-ink">
                  <Icon name={showDone ? "chevronDown" : "chevronRight"} size={14} /> Done · {done.length}
                </button>
                {showDone && <div className="mt-2 flex flex-col gap-2">{done.map(card)}</div>}
              </div>
            )}
          </section>

          <div className="flex flex-col gap-6">
            <DayNotes day={day} />
            {upcoming.length > 0 && (
              <section>
                <h2 className="mb-2 text-[16px]">Due this week</h2>
                <div className="flex flex-col">
                  {upcoming.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setSelectedId(t.id)}
                      className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-left text-[13px] hover:bg-sidebar"
                    >
                      {byId[t.businessId] && <BizMark business={byId[t.businessId]} size={18} />}
                      <span className="min-w-0 flex-1 truncate">{t.title}</span>
                      <span className="shrink-0 text-[12px] text-muted">{fmtDay(t.dueDate!, { weekday: "short", month: "short", day: "numeric" })}</span>
                    </button>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      </div>

      <aside
        className={`${selected ? "fixed inset-y-0 right-0 z-30 flex max-w-full shadow-2xl lg:static lg:shadow-none" : "hidden lg:flex"} w-[340px] shrink-0 flex-col border-l border-line bg-surface lg:bg-sidebar/50`}
      >
        {selected ? (
          <TaskDetails
            task={selected}
            businesses={businesses}
            onUpdate={(patch) => update(selected.id, patch)}
            onDelete={() => {
              remove(selected.id);
              setSelectedId(null);
            }}
            onClose={() => setSelectedId(null)}
          />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
            <span className="text-faint"><Icon name="board" size={26} /></span>
            <p className="mt-3 text-[14px] text-muted">Click a task to see its details here.</p>
          </div>
        )}
      </aside>
    </div>
  );
}
