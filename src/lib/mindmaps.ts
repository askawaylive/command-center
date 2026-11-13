import "server-only";
import { randomUUID } from "node:crypto";
import { deleteDoc, listDocs, putDocs } from "./store";

export interface MindNode {
  id: string;
  text: string;
  x: number;
  y: number;
  parent?: string; // undefined for the central topic
  color?: string;
}

export interface MindMap {
  id: string;
  title: string;
  nodes: MindNode[];
  createdAt: string;
  updatedAt: string;
}

const COLL = "mindmaps";
const HEX = /^#[0-9a-fA-F]{6}$/;
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.max(-1e6, Math.min(1e6, v)) : 0);

function cleanNodes(v: unknown): MindNode[] {
  if (!Array.isArray(v)) return [];
  return v.slice(0, 2000).flatMap((n) => {
    if (!n || typeof n !== "object" || typeof n.id !== "string") return [];
    return [
      {
        id: n.id.slice(0, 64),
        text: typeof n.text === "string" ? n.text.slice(0, 500) : "",
        x: num(n.x),
        y: num(n.y),
        parent: typeof n.parent === "string" ? n.parent.slice(0, 64) : undefined,
        color: typeof n.color === "string" && HEX.test(n.color) ? n.color : undefined,
      },
    ];
  });
}

export async function listMaps(): Promise<MindMap[]> {
  return ((await listDocs<MindMap>(COLL)) ?? []).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function createMap(title?: unknown): Promise<MindMap> {
  const now = new Date().toISOString();
  const t = typeof title === "string" && title.trim() ? title.trim().slice(0, 120) : "Untitled map";
  const m: MindMap = { id: randomUUID(), title: t, nodes: [{ id: randomUUID(), text: t, x: 0, y: 0 }], createdAt: now, updatedAt: now };
  await putDocs(COLL, [m]);
  return m;
}

export async function updateMap(id: string, patch: { title?: unknown; nodes?: unknown }): Promise<MindMap | undefined> {
  const m = (await listDocs<MindMap>(COLL))?.find((x) => x.id === id);
  if (!m) return undefined;
  if (typeof patch.title === "string") m.title = patch.title.trim().slice(0, 120) || "Untitled map";
  if (patch.nodes !== undefined) {
    const nodes = cleanNodes(patch.nodes);
    if (nodes.length) m.nodes = nodes;
  }
  m.updatedAt = new Date().toISOString();
  await putDocs(COLL, [m]);
  return m;
}

export async function deleteMap(id: string) {
  await deleteDoc(COLL, id);
}
