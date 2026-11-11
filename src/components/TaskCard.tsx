"use client";
import type { Business, Task } from "@/lib/types";
import { Icon } from "./Icon";
import { fmtMinutes } from "./useTasks";

export function TaskCard({
  task,
  business,
  onToggle,
  onDelete,
  compact,
}: {
  task: Task;
  business?: Business;
  onToggle: () => void;
  onDelete?: () => void;
  compact?: boolean;
}) {
  const done = task.status === "done";
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/task", task.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      className={`group card px-3 py-2.5 cursor-grab active:cursor-grabbing transition-shadow hover:shadow-[0_2px_10px_rgba(0,0,0,0.06)] ${done ? "opacity-55" : ""}`}
    >
      <div className="flex items-start gap-2.5">
        <button
          onClick={onToggle}
          aria-label={done ? "Mark not done" : "Mark done"}
          className={`mt-0.5 h-[18px] w-[18px] shrink-0 rounded-full border flex items-center justify-center transition-colors ${
            done ? "bg-good border-good text-white" : "border-faint hover:border-accent"
          }`}
        >
          {done && <Icon name="check" size={12} />}
        </button>
        <div className="min-w-0 flex-1">
          <div className={`text-[14px] leading-snug ${done ? "line-through text-muted" : ""}`}>{task.title}</div>
          {!compact && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[12px] text-muted">
              {business && (
                <span className="inline-flex items-center gap-1 rounded-md bg-sidebar px-1.5 py-0.5">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: business.color }} />
                  {business.name}
                </span>
              )}
              {task.launch && <span className="rounded-md bg-accent-soft text-accent px-1.5 py-0.5">{task.launch}</span>}
              {task.priority === "high" && <span className="text-bad">High</span>}
              {task.dueDate && <span>Due {new Date(task.dueDate + "T00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>}
            </div>
          )}
        </div>
        {task.estimateMin ? (
          <span className="shrink-0 rounded-md border border-line px-1.5 py-0.5 text-[11px] tabular-nums text-muted">{fmtMinutes(task.estimateMin)}</span>
        ) : null}
        {onDelete && (
          <button onClick={onDelete} aria-label="Delete task" className="shrink-0 text-faint opacity-0 group-hover:opacity-100 hover:text-bad">
            <Icon name="trash" size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
