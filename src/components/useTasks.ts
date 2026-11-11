"use client";
import { useCallback, useState } from "react";
import type { Task } from "@/lib/types";

export function useTasks(initial: Task[]) {
  const [tasks, setTasks] = useState(initial);

  const update = useCallback(async (id: string, patch: Partial<Task>) => {
    setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    const res = await fetch(`/api/tasks/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
    if (res.ok) {
      const saved = (await res.json()) as Task;
      setTasks((ts) => ts.map((t) => (t.id === id ? saved : t)));
    }
  }, []);

  const create = useCallback(async (input: Partial<Task> & Pick<Task, "title" | "businessId">) => {
    const res = await fetch("/api/tasks", { method: "POST", body: JSON.stringify(input) });
    const saved = (await res.json()) as Task;
    setTasks((ts) => [...ts, saved]);
    return saved;
  }, []);

  const remove = useCallback(async (id: string) => {
    setTasks((ts) => ts.filter((t) => t.id !== id));
    await fetch(`/api/tasks/${id}`, { method: "DELETE" });
  }, []);

  return { tasks, update, create, remove };
}

export function fmtMinutes(min: number) {
  if (!min) return "0:00";
  return `${Math.floor(min / 60)}:${String(min % 60).padStart(2, "0")}`;
}
