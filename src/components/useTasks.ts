"use client";
import { useCallback, useRef, useState } from "react";
import type { Task } from "@/lib/types";
import { toast } from "./Toast";

export function useTasks(initial: Task[]) {
  const [tasks, setTasks] = useState(initial);
  const latest = useRef(tasks);
  latest.current = tasks;

  const update = useCallback(async (id: string, patch: Partial<Task>) => {
    const before = latest.current.find((t) => t.id === id);
    setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    const res = await fetch(`/api/tasks/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
    if (res.ok) {
      const saved = (await res.json()) as Task;
      setTasks((ts) => ts.map((t) => (t.id === id ? saved : t)));
    } else {
      // Not allowed (e.g. it's still waiting on another task): put it back and say why.
      if (before) setTasks((ts) => ts.map((t) => (t.id === id ? before : t)));
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      toast(body?.error ?? "Couldn't save that change.");
    }
  }, []);

  const remove = useCallback(async (id: string) => {
    setTasks((ts) => ts.filter((t) => t.id !== id).map((t) => (t.dependsOn?.includes(id) ? { ...t, dependsOn: t.dependsOn.filter((d) => d !== id) } : t)));
    await fetch(`/api/tasks/${id}`, { method: "DELETE" });
  }, []);

  const create = useCallback(async (input: Partial<Task> & Pick<Task, "title" | "businessId">) => {
    const res = await fetch("/api/tasks", { method: "POST", body: JSON.stringify(input) });
    const saved = (await res.json()) as Task;
    setTasks((ts) => [...ts, saved]);
    return saved;
  }, []);

  return { tasks, update, create, remove };
}

export function fmtMinutes(min: number) {
  if (!min) return "0:00";
  return `${Math.floor(min / 60)}:${String(min % 60).padStart(2, "0")}`;
}
