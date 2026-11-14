import "server-only";
import { randomUUID } from "node:crypto";
import type { Task } from "./types";
import { deleteDoc, getKV, listDocs, putDocs, setKV } from "./store";
import { openBlockers, wouldCycle } from "./deps";
import { SITCOM_LAUNCH_PAD } from "./launchpads";

/** A change the dependency rules don't allow (e.g. completing a task whose blockers are still open). */
export class TaskRuleError extends Error {}

const COLL = "tasks";

/** Titles of the sample tasks the first version shipped with, removed once from existing databases. */
const DEMO_TITLES = new Set([
  "Finalize App Store screenshots",
  "Write launch email to waitlist",
  "Reply to Jordan about Thursday session",
  "Approve episode 4 callback list",
  "Pay venue deposit for Dec 6",
  "Review rough cut",
  "Holiday gift guide landing page",
  "Confirm linen throw restock with Lina",
  "Answer Maya about order #1043",
  "Reorder Glow Drops (30ml)",
  "Pick winter drop TikTok",
  "Set up wholesale price list",
  "Press kit for Askaway launch",
  "Spring collection sourcing",
]);
const CLEANED = "cleanup:demo-tasks-v1";

async function all(): Promise<Task[]> {
  let existing = (await listDocs<Task>(COLL)) ?? [];
  if (!(await getKV<boolean>(CLEANED))) {
    const demo = existing.filter((t) => DEMO_TITLES.has(t.title));
    for (const t of demo) await deleteDoc(COLL, t.id);
    existing = existing.filter((t) => !DEMO_TITLES.has(t.title));
    await setKV(CLEANED, true);
  }
  if (!(await getKV<boolean>(SITCOM_LAUNCH_PAD.key))) {
    const have = new Set(existing.map((t) => t.id));
    const add = SITCOM_LAUNCH_PAD.tasks().filter((t) => !have.has(t.id));
    if (add.length) await putDocs(COLL, add);
    existing = [...existing, ...add];
    await setKV(SITCOM_LAUNCH_PAD.key, true);
  }
  return existing.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
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
  const tasks = await all();
  const t = tasks.find((x) => x.id === id);
  if (!t) return undefined;
  if (patch.dependsOn) {
    const ids = [...new Set(patch.dependsOn)].filter((d) => tasks.some((x) => x.id === d));
    const loop = ids.find((d) => wouldCycle(id, d, tasks));
    if (loop) throw new TaskRuleError(`That would make a loop: "${tasks.find((x) => x.id === loop)?.title}" already waits on this task.`);
    patch.dependsOn = ids;
  }
  if (patch.status === "done" && t.status !== "done") {
    const open = openBlockers({ ...t, ...patch }, tasks);
    if (open.length) throw new TaskRuleError(`Finish ${open.map((b) => `"${b.title}"`).join(", ")} first.`);
  }
  Object.assign(t, patch, { id });
  if (patch.status === "done" && !t.completedAt) t.completedAt = new Date().toISOString();
  if (patch.status && patch.status !== "done") delete t.completedAt;
  await putDocs(COLL, [t]);
  return t;
}

export async function deleteTask(id: string) {
  await deleteDoc(COLL, id);
  // Nothing should keep waiting on a task that no longer exists.
  const waiting = (await all()).filter((t) => t.dependsOn?.includes(id));
  for (const t of waiting) t.dependsOn = t.dependsOn!.filter((d) => d !== id);
  if (waiting.length) await putDocs(COLL, waiting);
}
