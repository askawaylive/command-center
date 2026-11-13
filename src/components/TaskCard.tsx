"use client";
import type { Business, Task } from "@/lib/types";
import { Icon } from "./Icon";
import { BizMark } from "./BizMark";
import { fmtMinutes } from "./useTasks";

export function TaskCard({
  task,
  business,
  onToggle,
  onDelete,
  onOpen,
  selected,
  compact,
}: {
  task: Task;
  business?: Business;
  onToggle: () => void;
  onDelete?: () => void;
  onOpen?: () => void;
  selected?: boolean;
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
      onClick={(e) => {
        if (onOpen && !(e.target as HTMLElement).closest("button")) onOpen();
      }}
      className={`group card px-3 py-2.5 cursor-pointer active:cursor-grabbing transition-shadow hover:shadow-[0_2px_10px_rgba(0,0,0,0.06)] ${selected ? "!border-accent ring-1 ring-accent" : ""} ${done ? "opacity-55" : ""}`}
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
          {!compact && (task.launch || task.priority === "high" || task.dueDate) && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[12px] text-muted">
              {task.launch && <span className="rounded-md bg-accent-soft text-accent px-1.5 py-0.5">{task.launch}</span>}
              {task.priority === "high" && <span className="text-bad">High</span>}
              {task.dueDate && <span>Due {new Date(task.dueDate + "T00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>}
            </div>
          )}
        </div>
        {task.estimateMin ? (
          <span className="shrink-0 rounded-md border border-line px-1.5 py-0.5 text-[11px] tabular-nums text-muted">{fmtMinutes(task.estimateMin)}</span>
        ) : null}
        {business && (
          <span title={business.name} className="mt-px shrink-0">
            <BizMark business={business} size={20} />
          </span>
        )}
        {onDelete && (
          <button onClick={onDelete} aria-label="Delete task" className="shrink-0 text-faint opacity-0 group-hover:opacity-100 hover:text-bad">
            <Icon name="trash" size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
