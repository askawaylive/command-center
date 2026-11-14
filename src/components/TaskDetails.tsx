"use client";
import { useEffect, useState } from "react";
import type { Business, Priority, Task, TaskStatus } from "@/lib/types";
import { BizMark } from "./BizMark";
import { Icon } from "./Icon";
import { toast } from "./Toast";
import { dependentsOf, depsOf, openBlockers, stagesOf, wouldCycle } from "@/lib/deps";

const STATUSES: { id: TaskStatus; label: string }[] = [
  { id: "backlog", label: "Backlog" },
  { id: "todo", label: "To do" },
  { id: "doing", label: "In progress" },
  { id: "done", label: "Done" },
];
const PRIORITIES: Priority[] = ["low", "medium", "high"];
const ESTIMATES = [0, 10, 15, 20, 30, 45, 60, 90, 120, 180, 240];

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid grid-cols-[92px_1fr] items-center gap-3 text-[13px]">
      <span className="text-muted">{label}</span>
      {children}
    </label>
  );
}

/** Editable details for one task. Text fields save when you leave them; everything else saves right away. */
export function TaskDetails({
  task,
  businesses,
  allTasks = [],
  onUpdate,
  onDelete,
  onClose,
}: {
  task: Task;
  businesses: Business[];
  /** Every task, so this one can be linked to the tasks it waits on. */
  allTasks?: Task[];
  onUpdate: (patch: Partial<Task>) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes ?? "");
  const [launch, setLaunch] = useState(task.launch ?? "");
  const [stage, setStage] = useState(task.stage ?? "");
  useEffect(() => {
    setTitle(task.title);
    setNotes(task.notes ?? "");
    setLaunch(task.launch ?? "");
    setStage(task.stage ?? "");
  }, [task.id, task.title, task.notes, task.launch, task.stage]);

  const deps = depsOf(task, allTasks);
  const blockers = openBlockers(task, allTasks);
  const unlocks = dependentsOf(task, allTasks);
  // Tasks it could wait on: same business, not already linked, and not ones that would make a loop.
  const candidates = allTasks
    .filter((t) => t.businessId === task.businessId && t.id !== task.id && !task.dependsOn?.includes(t.id) && !wouldCycle(task.id, t.id, allTasks))
    .sort((a, b) => Number(b.launch === task.launch) - Number(a.launch === task.launch) || Number(a.status === "done") - Number(b.status === "done"));
  const stages = stagesOf(allTasks.filter((t) => t.businessId === task.businessId && t.launch === task.launch));
  const setDeps = (ids: string[]) => onUpdate({ dependsOn: ids });

  const biz = businesses.find((b) => b.id === task.businessId);
  const done = task.status === "done";
  const field = "input !py-1.5";

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        {biz && <BizMark business={biz} size={22} />}
        <span className="truncate text-[13px] text-muted">{biz?.name ?? "No business"}</span>
        <button onClick={onDelete} aria-label="Delete task" className="ml-auto rounded-md p-1.5 text-faint hover:bg-sidebar hover:text-bad">
          <Icon name="trash" size={15} />
        </button>
        <button onClick={onClose} aria-label="Close details" className="rounded-md p-1.5 text-faint hover:bg-sidebar hover:text-ink">
          <Icon name="x" size={15} />
        </button>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto scroll-thin p-4 pb-24">
        <div className="flex items-start gap-2.5">
          <button
            onClick={() =>
              !done && blockers.length
                ? toast(`Finish ${blockers.map((b) => `"${b.title}"`).join(", ")} first.`)
                : onUpdate({ status: done ? "todo" : "done" })
            }
            aria-label={done ? "Mark not done" : blockers.length ? "Waiting on other tasks" : "Mark done"}
            className={`mt-1.5 h-5 w-5 shrink-0 rounded-full border flex items-center justify-center transition-colors ${
              done ? "bg-good border-good text-white" : blockers.length ? "border-line bg-sidebar text-faint cursor-not-allowed" : "border-faint hover:border-accent"
            }`}
          >
            {done && <Icon name="check" size={13} />}
            {!done && blockers.length > 0 && <Icon name="lock" size={11} />}
          </button>
          <textarea
            rows={2}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => title.trim() && title.trim() !== task.title && onUpdate({ title: title.trim() })}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                (e.target as HTMLTextAreaElement).blur();
              }
            }}
            aria-label="Task title"
            className={`w-full resize-none bg-transparent text-[18px] font-semibold leading-snug tracking-tight outline-none ${done ? "line-through text-muted" : ""}`}
          />
        </div>

        <div className="space-y-2.5">
          <Row label="Business">
            <select className={field} value={task.businessId} onChange={(e) => onUpdate({ businessId: e.target.value })}>
              {businesses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </Row>
          <Row label="Status">
            <select className={field} value={task.status} onChange={(e) => onUpdate({ status: e.target.value as TaskStatus })}>
              {STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </Row>
          <Row label="Priority">
            <select className={field} value={task.priority} onChange={(e) => onUpdate({ priority: e.target.value as Priority })}>
              {PRIORITIES.map((p) => <option key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</option>)}
            </select>
          </Row>
          <Row label="Planned for">
            <input type="date" className={field} value={task.plannedFor ?? ""} onChange={(e) => onUpdate({ plannedFor: e.target.value })} />
          </Row>
          <Row label="Due">
            <input type="date" className={field} value={task.dueDate ?? ""} onChange={(e) => onUpdate({ dueDate: e.target.value })} />
          </Row>
          <Row label="Time">
            <select className={field} value={task.estimateMin ?? 0} onChange={(e) => onUpdate({ estimateMin: Number(e.target.value) || undefined })}>
              {[...new Set([...ESTIMATES, task.estimateMin ?? 0])].sort((a, b) => a - b).map((m) => (
                <option key={m} value={m}>{m ? (m < 60 ? `${m} min` : `${m / 60} hr`) : "None"}</option>
              ))}
            </select>
          </Row>
          <Row label="Launch">
            <input
              className={field}
              placeholder="e.g. Holiday drop"
              value={launch}
              onChange={(e) => setLaunch(e.target.value)}
              onBlur={() => launch.trim() !== (task.launch ?? "") && onUpdate({ launch: launch.trim() || undefined })}
            />
          </Row>
          {(task.launch || task.stage) && (
            <Row label="Stage">
              <>
                <input
                  className={field}
                  list={`stages-${task.id}`}
                  placeholder="e.g. Build"
                  value={stage}
                  onChange={(e) => setStage(e.target.value)}
                  onBlur={() => stage.trim() !== (task.stage ?? "") && onUpdate({ stage: stage.trim() || undefined })}
                />
                <datalist id={`stages-${task.id}`}>
                  {stages.map((s) => <option key={s} value={s} />)}
                </datalist>
              </>
            </Row>
          )}
          <Row label="Costs money">
            <span className="flex items-center">
              <input type="checkbox" className="h-4 w-4 accent-[var(--bad)]" checked={!!task.costs} onChange={(e) => onUpdate({ costs: e.target.checked || undefined })} />
            </span>
          </Row>
        </div>

        <div>
          <div className="mb-1.5 flex items-center gap-1.5 text-[13px] text-muted">
            <Icon name="lock" size={13} /> Waiting on
            {blockers.length > 0 && <span className="ml-auto text-[12px] text-bad">{blockers.length} not done</span>}
          </div>
          {deps.length === 0 && <p className="mb-2 text-[12px] text-faint">Nothing. Add a task that has to be finished before this one.</p>}
          <ul className="mb-2 space-y-1">
            {deps.map((d) => (
              <li key={d.id} className="group flex items-center gap-2 rounded-lg border border-line px-2.5 py-1.5 text-[13px]">
                <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${d.status === "done" ? "border-good bg-good text-white" : "border-faint"}`}>
                  {d.status === "done" && <Icon name="check" size={10} />}
                </span>
                <span className={`min-w-0 flex-1 truncate ${d.status === "done" ? "text-muted line-through" : ""}`}>{d.title}</span>
                <button
                  onClick={() => setDeps((task.dependsOn ?? []).filter((x) => x !== d.id))}
                  aria-label={`Stop waiting on ${d.title}`}
                  className="text-faint opacity-60 hover:text-bad group-hover:opacity-100"
                >
                  <Icon name="x" size={13} />
                </button>
              </li>
            ))}
          </ul>
          {candidates.length > 0 && (
            <select
              className={field}
              value=""
              aria-label="Add a task this waits on"
              onChange={(e) => e.target.value && setDeps([...(task.dependsOn ?? []), e.target.value])}
            >
              <option value="">+ Add a task this waits on…</option>
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.status === "done" ? "✓ " : ""}
                  {c.title}
                  {c.launch && c.launch !== task.launch ? ` (${c.launch})` : ""}
                </option>
              ))}
            </select>
          )}
          {unlocks.length > 0 && (
            <div className="mt-3 text-[12px] text-muted">
              <span className="text-faint">Finishing this unlocks: </span>
              {unlocks.map((u) => u.title).join(", ")}
            </div>
          )}
        </div>

        <div>
          <div className="mb-1.5 text-[13px] text-muted">Notes</div>
          <textarea
            rows={8}
            className="input resize-y leading-relaxed"
            placeholder="Add details, links, next steps…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => notes !== (task.notes ?? "") && onUpdate({ notes })}
          />
        </div>

        <div className="text-[12px] text-faint">
          Created {new Date(task.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
          {task.completedAt && ` · Done ${new Date(task.completedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`}
        </div>
      </div>
    </div>
  );
}
