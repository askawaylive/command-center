import "server-only";
import { randomUUID } from "node:crypto";
import type { Task } from "./types";
import { isoDay, addDays } from "./dates";
import { deleteDoc, listDocs, putDocs } from "./store";

const COLL = "tasks";

function seed(): { tasks: Task[] } {
  const t = isoDay();
  const mk = (p: Partial<Task> & Pick<Task, "title" | "businessId">): Task => ({
    id: randomUUID(),
    status: "todo",
    priority: "medium",
    createdAt: new Date().toISOString(),
    ...p,
  });
  return {
    tasks: [
      mk({ title: "Finalize App Store screenshots", businessId: "askaway", launch: "Askaway 2.3", plannedFor: t, estimateMin: 60, priority: "high", status: "doing" }),
      mk({ title: "Write launch email to waitlist", businessId: "askaway", launch: "Askaway 2.3", plannedFor: t, estimateMin: 45, priority: "high" }),
      mk({ title: "Reply to Jordan about Thursday session", businessId: "askaway", plannedFor: t, estimateMin: 10 }),
      mk({ title: "Approve episode 4 callback list", businessId: "sitcom", plannedFor: t, estimateMin: 30, dueDate: addDays(t, 3) }),
      mk({ title: "Pay venue deposit for Dec 6", businessId: "sitcom", plannedFor: addDays(t, 1), estimateMin: 15, priority: "high" }),
      mk({ title: "Review rough cut", businessId: "sitcom", plannedFor: addDays(t, 1), estimateMin: 45 }),
      mk({ title: "Holiday gift guide landing page", businessId: "homelove", launch: "Holiday drop", plannedFor: addDays(t, 1), estimateMin: 90, priority: "high" }),
      mk({ title: "Confirm linen throw restock with Lina", businessId: "homelove", plannedFor: t, estimateMin: 15 }),
      mk({ title: "Answer Maya about order #1043", businessId: "homelove", plannedFor: t, estimateMin: 10, status: "done", completedAt: new Date().toISOString() }),
      mk({ title: "Reorder Glow Drops (30ml)", businessId: "littletan", plannedFor: t, estimateMin: 20, priority: "high" }),
      mk({ title: "Pick winter drop TikTok", businessId: "littletan", launch: "Winter drop", plannedFor: addDays(t, 2), estimateMin: 20 }),
      mk({ title: "Set up wholesale price list", businessId: "littletan", status: "backlog" }),
      mk({ title: "Press kit for Askaway launch", businessId: "askaway", launch: "Askaway 2.3", status: "backlog", dueDate: addDays(t, 7) }),
      mk({ title: "Spring collection sourcing", businessId: "homelove", status: "backlog" }),
    ],
  };
}

async function all(): Promise<Task[]> {
  const existing = await listDocs<Task>(COLL);
  if (existing) return existing.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const { tasks } = seed();
  await putDocs(COLL, tasks);
  return tasks;
}

export async function listTasks(filter: { businessId?: string } = {}): Promise<Task[]> {
  return (await all()).filter((t) => !filter.businessId || t.businessId === filter.businessId);
}

export async function createTask(input: Partial<Task> & Pick<Task, "title" | "businessId">): Promise<Task> {
  await all();
  const task: Task = {
    id: randomUUID(),
    status: "todo",
    priority: "medium",
    createdAt: new Date().toISOString(),
    ...input,
  };
  await putDocs(COLL, [task]);
  return task;
}

export async function updateTask(id: string, patch: Partial<Task>): Promise<Task | undefined> {
  const t = (await all()).find((x) => x.id === id);
  if (!t) return undefined;
  Object.assign(t, patch, { id });
  if (patch.status === "done" && !t.completedAt) t.completedAt = new Date().toISOString();
  if (patch.status && patch.status !== "done") delete t.completedAt;
  await putDocs(COLL, [t]);
  return t;
}

export async function deleteTask(id: string) {
  await deleteDoc(COLL, id);
}
