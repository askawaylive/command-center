"use client";
import { useMemo, useState } from "react";
import type { Business, Task, TaskStatus } from "@/lib/types";
import { TaskCard } from "./TaskCard";
import { AddTask } from "./AddTask";
import { useTasks } from "./useTasks";

const COLUMNS: { id: TaskStatus; label: string }[] = [
  { id: "backlog", label: "Backlog" },
  { id: "todo", label: "To do" },
  { id: "doing", label: "In progress" },
  { id: "done", label: "Done" },
];

export function Board({ initialTasks, businesses, fixedBusiness }: { initialTasks: Task[]; businesses: Business[]; fixedBusiness?: string }) {
  const { tasks, update, create, remove } = useTasks(initialTasks);
  const [biz, setBiz] = useState<string>(fixedBusiness ?? "all");
  const [launch, setLaunch] = useState<string>("all");
  const [over, setOver] = useState<string | null>(null);
  const byId = useMemo(() => Object.fromEntries(businesses.map((b) => [b.id, b])), [businesses]);

  const scoped = tasks.filter((t) => biz === "all" || t.businessId === biz);
  const launches = [...new Set(scoped.map((t) => t.launch).filter(Boolean))] as string[];
  const visible = scoped.filter((t) => launch === "all" || t.launch === launch);

  const chip = (active: boolean) =>
    `rounded-full px-3 py-1 text-[13px] border transition-colors ${active ? "bg-ink text-bg border-ink" : "border-line text-muted hover:text-ink"}`;

  return (
    <div className="px-8 pb-8">
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {!fixedBusiness && (
          <>
            <button className={chip(biz === "all")} onClick={() => setBiz("all")}>All businesses</button>
            {businesses.map((b) => (
              <button key={b.id} className={chip(biz === b.id)} onClick={() => { setBiz(b.id); setLaunch("all"); }}>
                <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: b.color }} />
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
        <LaunchProgress tasks={scoped.filter((t) => t.launch === launch)} name={launch} />
      )}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
                    business={byId[t.businessId]}
                    onToggle={() => update(t.id, { status: t.status === "done" ? "todo" : "done" })}
                    onDelete={() => remove(t.id)}
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
    </div>
  );
}

function LaunchProgress({ tasks, name }: { tasks: Task[]; name: string }) {
  const done = tasks.filter((t) => t.status === "done").length;
  const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  const due = tasks.map((t) => t.dueDate).filter(Boolean).sort().at(-1);
  return (
    <div className="card mb-5 flex items-center gap-4 p-4">
      <div className="flex-1">
        <div className="text-[13px] text-muted">Launch</div>
        <div className="font-serif text-[20px]">{name}</div>
      </div>
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
