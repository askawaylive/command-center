"use client";
import type { Business, Task } from "@/lib/types";
import { Icon } from "./Icon";
import { BizMark } from "./BizMark";
import { fmtMinutes } from "./useTasks";
import { toast } from "./Toast";

export function TaskCard({
  task,
  business,
  onToggle,
  onDelete,
  onOpen,
  selected,
  compact,
  deps = [],
}: {
  task: Task;
  business?: Business;
  onToggle: () => void;
  onDelete?: () => void;
  onOpen?: () => void;
  selected?: boolean;
  compact?: boolean;
  /** Tasks this one waits on. While any is unfinished, the card shows a lock and can't be checked off. */
  deps?: Task[];
}) {
  const done = task.status === "done";
  const waiting = done ? [] : deps.filter((d) => d.status !== "done");
  const locked = waiting.length > 0;
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
      className={`group card px-3 py-2.5 cursor-pointer active:cursor-grabbing transition-shadow hover:shadow-[0_2px_10px_rgba(0,0,0,0.06)] ${task.costs && !done ? "border-bad/50" : ""} ${selected ? "!border-accent ring-1 ring-accent" : ""} ${done ? "opacity-55" : ""}`}
    >
      <div className="flex items-start gap-2.5">
        <button
          onClick={() => (locked ? toast(`Finish ${waiting.map((w) => `"${w.title}"`).join(", ")} first.`) : onToggle())}
          aria-label={done ? "Mark not done" : locked ? "Waiting on other tasks" : "Mark done"}
          title={locked ? `Waiting on ${waiting.map((w) => w.title).join(", ")}` : undefined}
          className={`mt-0.5 h-[18px] w-[18px] shrink-0 rounded-full border flex items-center justify-center transition-colors ${
            done ? "bg-good border-good text-white" : locked ? "border-line bg-sidebar text-faint cursor-not-allowed" : "border-faint hover:border-accent"
          }`}
        >
          {done && <Icon name="check" size={12} />}
          {locked && <Icon name="lock" size={10} />}
        </button>
        <div className="min-w-0 flex-1">
          <div className={`text-[14px] leading-snug ${done ? "line-through text-muted" : ""}`}>{task.title}</div>
          {!compact && deps.length > 0 && !done && (
            <div className="mt-1 text-[12px] leading-snug text-muted">
              <span className="text-faint">Needs: </span>
              {deps.map((d, i) => (
                <span key={d.id} className={d.status === "done" ? "text-good line-through decoration-1" : ""}>
                  {i > 0 && ", "}
                  {d.title}
                </span>
              ))}
            </div>
          )}
          {!compact && (task.launch || task.priority === "high" || task.dueDate || task.costs) && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[12px] text-muted">
              {task.launch && <span className="rounded-md bg-accent-soft text-accent px-1.5 py-0.5">{task.launch}</span>}
              {task.costs && <span className="rounded-md border border-bad/40 px-1.5 py-0.5 text-bad">Costs money</span>}
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
