"use client";
import { useEffect, useState } from "react";
import type { Business, Priority, Task, TaskStatus } from "@/lib/types";
import { BizMark } from "./BizMark";
import { Icon } from "./Icon";

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
  onUpdate,
  onDelete,
  onClose,
}: {
  task: Task;
  businesses: Business[];
  onUpdate: (patch: Partial<Task>) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes ?? "");
  const [launch, setLaunch] = useState(task.launch ?? "");
  useEffect(() => {
    setTitle(task.title);
    setNotes(task.notes ?? "");
    setLaunch(task.launch ?? "");
  }, [task.id, task.title, task.notes, task.launch]);

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
            onClick={() => onUpdate({ status: done ? "todo" : "done" })}
            aria-label={done ? "Mark not done" : "Mark done"}
            className={`mt-1.5 h-5 w-5 shrink-0 rounded-full border flex items-center justify-center transition-colors ${
              done ? "bg-good border-good text-white" : "border-faint hover:border-accent"
            }`}
          >
            {done && <Icon name="check" size={13} />}
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
