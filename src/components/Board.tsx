"use client";
import { useEffect, useMemo, useState } from "react";
import type { Business, Task, TaskStatus } from "@/lib/types";
import { TaskCard } from "./TaskCard";
import { AddTask } from "./AddTask";
import { useTasks } from "./useTasks";
import { BizMark } from "./BizMark";
import { TaskDetails } from "./TaskDetails";
import { LaunchPad } from "./LaunchPad";
import { depsOf, stagesOf } from "@/lib/deps";

const COLUMNS: { id: TaskStatus; label: string }[] = [
  { id: "backlog", label: "Backlog" },
  { id: "todo", label: "To do" },
  { id: "doing", label: "In progress" },
  { id: "done", label: "Done" },
];

export function Board({ initialTasks, businesses, fixedBusiness, embedded }: { initialTasks: Task[]; businesses: Business[]; fixedBusiness?: string; embedded?: boolean }) {
  const { tasks, update, create, remove } = useTasks(initialTasks);
  const [biz, setBiz] = useState<string>(fixedBusiness ?? "all");
  // A business with a staged launch plan opens straight onto its launch pad.
  const firstPad = (b: string) => (b === "all" ? "all" : (tasks.find((t) => t.businessId === b && t.launch && t.stage)?.launch ?? "all"));
  const [launch, setLaunch] = useState<string>(() => firstPad(fixedBusiness ?? "all"));
  const [over, setOver] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = tasks.find((t) => t.id === selectedId);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSelectedId(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const byId = useMemo(() => Object.fromEntries(businesses.map((b) => [b.id, b])), [businesses]);

  const scoped = tasks.filter((t) => biz === "all" || t.businessId === biz);
  const launches = [...new Set(scoped.map((t) => t.launch).filter(Boolean))] as string[];
  const visible = scoped.filter((t) => launch === "all" || t.launch === launch);
  const hasStages = launch !== "all" && stagesOf(visible).length > 0;
  const [view, setView] = useState<"pad" | "board">("pad");
  const showPad = hasStages && view === "pad";

  const chip = (active: boolean) =>
    `inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] border transition-colors ${active ? "bg-ink text-bg border-ink" : "border-line text-muted hover:text-ink"}`;

  return (
    <div className={embedded ? "@container" : `px-8 pb-8 transition-[padding] ${selected ? "lg:pr-[372px]" : ""}`}>
      <div className={`flex flex-wrap items-center gap-2 ${embedded ? "mb-3 empty:hidden" : "mb-5"}`}>
        {!fixedBusiness && (
          <>
            <button className={chip(biz === "all")} onClick={() => { setBiz("all"); setLaunch("all"); }}>All businesses</button>
            {businesses.map((b) => (
              <button key={b.id} className={`${chip(biz === b.id)} !pl-1.5`} onClick={() => { setBiz(b.id); setLaunch(firstPad(b.id)); }}>
                <BizMark business={b} size={18} />
                {b.name}
              </button>
            ))}
          </>
        )}
        {launches.length > 0 && (
          <select className="input !w-auto !py-1 !rounded-full ml-auto" value={launch} onChange={(e) => setLaunch(e.target.value)} aria-label="Filter by launch">
            <option value="all">All launches</option>
            {launches.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        )}
      </div>
      {launch !== "all" && (
        <LaunchProgress tasks={scoped.filter((t) => t.launch === launch)} name={launch}>
          {hasStages && (
            <div className="flex rounded-full border border-line p-0.5 text-[13px]">
              {(["pad", "board"] as const).map((v) => (
                <button key={v} onClick={() => setView(v)} className={`rounded-full px-3 py-1 ${view === v ? "bg-ink text-bg" : "text-muted hover:text-ink"}`}>
                  {v === "pad" ? "Launch pad" : "Board"}
                </button>
              ))}
            </div>
          )}
        </LaunchProgress>
      )}
      {showPad ? (
        <LaunchPad tasks={visible} all={tasks} byId={byId} selectedId={selectedId} onOpen={setSelectedId} onToggle={(t) => update(t.id, { status: t.status === "done" ? "todo" : "done" })} businesses={businesses} onCreate={create} />
      ) : (
      <div className={embedded ? "grid gap-3 @xl:grid-cols-2 @5xl:grid-cols-4" : `grid gap-4 md:grid-cols-2 ${selected ? "xl:grid-cols-[repeat(4,minmax(250px,1fr))] xl:overflow-x-auto xl:scroll-thin xl:pb-2" : "xl:grid-cols-4"}`}>
        {COLUMNS.map((c) => {
          const list = visible.filter((t) => t.status === c.id);
          return (
            <section
              key={c.id}
              onDragOver={(e) => { e.preventDefault(); setOver(c.id); }}
              onDragLeave={() => setOver((o) => (o === c.id ? null : o))}
              onDrop={(e) => {
                e.preventDefault();
                setOver(null);
                const id = e.dataTransfer.getData("text/task");
                if (id) update(id, { status: c.id });
              }}
              className={`rounded-2xl bg-sidebar/60 p-3 min-h-[200px] transition-colors ${over === c.id ? "!bg-accent-soft" : ""}`}
            >
              <div className="mb-3 flex items-center justify-between px-1">
                <h2 className="font-serif text-[18px]">{c.label}</h2>
                <span className="text-[12px] text-faint tabular-nums">{list.length}</span>
              </div>
              <div className="flex flex-col gap-2">
                {list.map((t) => (
                  <TaskCard
                    key={t.id}
                    task={t}
                    deps={depsOf(t, tasks)}
                    business={byId[t.businessId]}
                    onToggle={() => update(t.id, { status: t.status === "done" ? "todo" : "done" })}
                    onOpen={() => setSelectedId(t.id)}
                    selected={t.id === selectedId}
                  />
                ))}
                {c.id !== "done" && (
                  <AddTask
                    businesses={businesses}
                    defaults={{ status: c.id, businessId: biz === "all" ? undefined : biz, launch: launch === "all" ? undefined : launch }}
                    onCreate={create}
                  />
                )}
              </div>
            </section>
          );
        })}
      </div>
      )}
      {selected && (
        <aside className="fixed inset-y-0 right-0 z-30 flex w-[340px] max-w-full flex-col border-l border-line bg-surface shadow-2xl">
          <TaskDetails
            task={selected}
            businesses={businesses}
            allTasks={tasks}
            onUpdate={(patch) => update(selected.id, patch)}
            onDelete={() => {
              remove(selected.id);
              setSelectedId(null);
            }}
            onClose={() => setSelectedId(null)}
          />
        </aside>
      )}
    </div>
  );
}

function LaunchProgress({ tasks, name, children }: { tasks: Task[]; name: string; children?: React.ReactNode }) {
  const done = tasks.filter((t) => t.status === "done").length;
  const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  const due = tasks.map((t) => t.dueDate).filter(Boolean).sort().at(-1);
  return (
    <div className="card mb-5 flex items-center gap-4 p-4">
      <div className="flex-1">
        <div className="text-[13px] text-muted">Launch</div>
        <div className="font-serif text-[20px]">{name}</div>
      </div>
      {children}
      <div className="w-1/2">
        <div className="mb-1 flex justify-between text-[12px] text-muted">
          <span>{done} of {tasks.length} tasks done{due ? ` · last due ${due}` : ""}</span>
          <span className="tabular-nums">{pct}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-line">
          <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}
