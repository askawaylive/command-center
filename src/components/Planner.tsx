"use client";
import { useMemo, useState } from "react";
import type { Business, Email, Task } from "@/lib/types";
import { addDays, isoDay } from "@/lib/dates";
import { TaskCard } from "./TaskCard";
import { AddTask } from "./AddTask";
import { useTasks, fmtMinutes } from "./useTasks";
import { Icon } from "./Icon";

const DAYS_SHOWN = 5;
const WORKDAY_MIN = 6 * 60;

function dayLabel(iso: string, today: string) {
  if (iso === today) return "Today";
  if (iso === addDays(today, 1)) return "Tomorrow";
  return new Date(iso + "T00:00").toLocaleDateString(undefined, { weekday: "long" });
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export function Planner({ initialTasks, businesses, emails, name }: { initialTasks: Task[]; businesses: Business[]; emails: Email[]; name?: string }) {
  const { tasks, update, create, remove } = useTasks(initialTasks);
  const [panel, setPanel] = useState<"backlog" | "inbox">("backlog");
  const [over, setOver] = useState<string | null>(null);
  const today = isoDay();
  const days = Array.from({ length: DAYS_SHOWN }, (_, i) => addDays(today, i));
  const byId = useMemo(() => Object.fromEntries(businesses.map((b) => [b.id, b])), [businesses]);

  // Unfinished tasks from past days roll forward into today, like a daily planner should.
  const plannedOn = (t: Task) => (t.plannedFor && t.plannedFor < today && t.status !== "done" ? today : t.plannedFor);
  const unplanned = tasks.filter((t) => !t.plannedFor && t.status !== "done");

  const drop = (e: React.DragEvent, target: string | null) => {
    e.preventDefault();
    setOver(null);
    const id = e.dataTransfer.getData("text/task");
    if (!id) return;
    update(id, target ? { plannedFor: target, status: tasks.find((t) => t.id === id)?.status === "backlog" ? "todo" : undefined } : { plannedFor: "", status: "backlog" });
  };
  const dropZone = (key: string, target: string | null) => ({
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      setOver(key);
    },
    onDragLeave: () => setOver((o) => (o === key ? null : o)),
    onDrop: (e: React.DragEvent) => drop(e, target),
  });

  const toggle = (t: Task) => update(t.id, { status: t.status === "done" ? "todo" : "done" });
  const todayTasks = tasks.filter((t) => plannedOn(t) === today);
  const todayDone = todayTasks.filter((t) => t.status === "done").length;

  return (
    <div className="flex h-full">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="px-8 pt-8 pb-5">
          <div className="text-[13px] text-muted">{new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</div>
          <h1 className="font-serif text-[32px] leading-tight tracking-tight mt-1">
            {greeting()}{name ? `, ${name}` : ""}
          </h1>
          <p className="mt-1 text-[15px] text-muted">
            {todayTasks.length === 0
              ? "Nothing planned yet. Drag something in from your backlog."
              : `${todayDone} of ${todayTasks.length} done today across ${new Set(todayTasks.map((t) => t.businessId)).size} businesses.`}
          </p>
        </header>
        <div className="flex flex-1 gap-4 overflow-x-auto scroll-thin px-8 pb-8">
          {days.map((d) => {
            const list = tasks
              .filter((t) => plannedOn(t) === d)
              .sort((a, b) => Number(a.status === "done") - Number(b.status === "done"));
            const total = list.reduce((s, t) => s + (t.estimateMin ?? 0), 0);
            const isToday = d === today;
            return (
              <section
                key={d}
                {...dropZone(d, d)}
                className={`flex w-[290px] shrink-0 flex-col rounded-2xl p-2 transition-colors ${over === d ? "bg-accent-soft" : ""}`}
              >
                <div className="px-2 pb-3">
                  <div className="flex items-baseline justify-between">
                    <h2 className={`font-serif text-[20px] ${isToday ? "text-accent" : ""}`}>{dayLabel(d, today)}</h2>
                    <span className="text-[12px] text-faint">{new Date(d + "T00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-[12px] text-muted">
                    <Icon name="clock" size={13} />
                    <span className="tabular-nums">{fmtMinutes(total)} planned</span>
                    <div className="h-1 flex-1 overflow-hidden rounded-full bg-line">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${Math.min(100, (total / WORKDAY_MIN) * 100)}%`, background: total > WORKDAY_MIN ? "var(--bad)" : "var(--accent)" }}
                      />
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  {list.map((t) => (
                    <TaskCard key={t.id} task={t} business={byId[t.businessId]} onToggle={() => toggle(t)} onDelete={() => remove(t.id)} />
                  ))}
                  <AddTask businesses={businesses} defaults={{ plannedFor: d, status: "todo" }} onCreate={create} />
                </div>
              </section>
            );
          })}
        </div>
      </div>

      <aside className="hidden lg:flex w-[320px] shrink-0 flex-col border-l border-line bg-sidebar/50">
        <div className="flex gap-1 p-3 border-b border-line">
          {(["backlog", "inbox"] as const).map((p) => (
            <button key={p} onClick={() => setPanel(p)} className={`btn flex-1 justify-center ${panel === p ? "bg-surface border border-line text-ink" : "btn-ghost"}`}>
              {p === "backlog" ? `Backlog · ${unplanned.length}` : `Inbox · ${emails.filter((e) => e.unread).length}`}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto scroll-thin p-3">
          {panel === "backlog" ? (
            <div {...dropZone("backlog", null)} className={`flex min-h-full flex-col gap-2 rounded-xl ${over === "backlog" ? "bg-accent-soft" : ""}`}>
              <p className="px-1 text-[12px] text-muted">Drag onto a day to plan it.</p>
              {unplanned.map((t) => (
                <TaskCard key={t.id} task={t} business={byId[t.businessId]} onToggle={() => toggle(t)} onDelete={() => remove(t.id)} />
              ))}
              <AddTask businesses={businesses} defaults={{ status: "backlog" }} onCreate={create} label="Add to backlog" />
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {emails.slice(0, 20).map((e) => (
                <div key={e.id} className="card p-3">
                  <div className="flex items-center gap-2 text-[12px] text-muted">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: byId[e.businessId]?.color }} />
                    <span className="truncate">{e.from}</span>
                    {e.unread && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-accent" />}
                  </div>
                  <div className={`mt-1 text-[13px] leading-snug ${e.unread ? "font-medium" : ""}`}>{e.subject}</div>
                  <div className="mt-0.5 line-clamp-2 text-[12px] text-muted">{e.snippet}</div>
                  <button
                    onClick={() => create({ title: `Follow up: ${e.subject}`, businessId: e.businessId, plannedFor: today, estimateMin: 15, notes: `From ${e.from}` })}
                    className="mt-2 inline-flex items-center gap-1 text-[12px] text-accent hover:underline"
                  >
                    <Icon name="plus" size={12} /> Plan for today
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
