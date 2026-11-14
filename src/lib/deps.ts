import type { Task } from "./types";

/** Tasks this one waits on, in the order they were added (missing ones dropped). */
export function depsOf(task: Task, all: Task[]): Task[] {
  return (task.dependsOn ?? []).map((id) => all.find((t) => t.id === id)).filter((t): t is Task => !!t);
}

/** Tasks this one waits on that aren't done yet. */
export function openBlockers(task: Task, all: Task[]): Task[] {
  return depsOf(task, all).filter((t) => t.status !== "done");
}

/** Tasks that wait on this one. */
export function dependentsOf(task: Task, all: Task[]): Task[] {
  return all.filter((t) => t.dependsOn?.includes(task.id));
}

/** True if making `taskId` wait on `depId` would create a loop (depId already waits on taskId, directly or not). */
export function wouldCycle(taskId: string, depId: string, all: Task[]): boolean {
  if (taskId === depId) return true;
  const byId = new Map(all.map((t) => [t.id, t]));
  const seen = new Set<string>();
  const stack = [depId];
  while (stack.length) {
    const id = stack.pop()!;
    if (id === taskId) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    stack.push(...(byId.get(id)?.dependsOn ?? []));
  }
  return false;
}

/** Stages in a launch, in the order they first appear (tasks are oldest first). */
export function stagesOf(tasks: Task[]): string[] {
  const out: string[] = [];
  for (const t of [...tasks].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    const s = t.stage?.trim();
    if (s && !out.includes(s)) out.push(s);
  }
  return out;
}
