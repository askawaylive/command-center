"use client";
import { useState } from "react";
import type { Business, Task } from "@/lib/types";
import { Icon } from "./Icon";

export function AddTask({
  businesses,
  defaults,
  onCreate,
  label = "Add task",
}: {
  businesses: Business[];
  defaults: Partial<Task>;
  onCreate: (t: Partial<Task> & Pick<Task, "title" | "businessId">) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [businessId, setBusinessId] = useState(defaults.businessId ?? businesses[0]?.id);
  const [estimate, setEstimate] = useState("30");

  if (!open)
    return (
      <button onClick={() => setOpen(true)} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-[13px] text-faint hover:text-accent">
        <Icon name="plus" size={14} /> {label}
      </button>
    );

  const submit = () => {
    if (!title.trim()) return setOpen(false);
    onCreate({ ...defaults, title: title.trim(), businessId, estimateMin: Number(estimate) || undefined });
    setTitle("");
  };

  return (
    <div className="card p-2.5 space-y-2">
      <input
        autoFocus
        className="input"
        placeholder="What needs doing?"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") setOpen(false);
        }}
      />
      <div className="flex gap-2">
        <select className="input !py-1.5" value={businessId} onChange={(e) => setBusinessId(e.target.value)}>
          {businesses.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
        <select className="input !py-1.5 !w-24" value={estimate} onChange={(e) => setEstimate(e.target.value)} aria-label="Time estimate">
          {["10", "15", "30", "45", "60", "90", "120"].map((m) => (
            <option key={m} value={m}>{m}m</option>
          ))}
        </select>
      </div>
      <div className="flex justify-end gap-1">
        <button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
        <button className="btn btn-primary" onClick={submit}>Add</button>
      </div>
    </div>
  );
}
