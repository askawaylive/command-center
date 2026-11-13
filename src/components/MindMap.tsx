"use client";
import { createContext, memo, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  Handle,
  NodeToolbar,
  Position,
  useReactFlow,
  type Edge,
  type Node,
  type NodeChange,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Icon } from "./Icon";

export interface MindNode {
  id: string;
  text: string;
  x: number;
  y: number;
  parent?: string;
  color?: string;
}
export interface MindMap {
  id: string;
  title: string;
  nodes: MindNode[];
  createdAt: string;
  updatedAt: string;
}

const PALETTE = ["#eb6834", "#2a78d6", "#1baf7a", "#eda100", "#e87ba4", "#6250d6", "#e34948", "#008300"];
const GAP_X = 250;
const ROW = 62;
const uid = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2));

/* ---------- tree helpers ---------- */

function childrenOf(nodes: MindNode[], id: string) {
  return nodes.filter((n) => n.parent === id);
}
function descendants(nodes: MindNode[], id: string): string[] {
  const out: string[] = [];
  const walk = (p: string) => childrenOf(nodes, p).forEach((c) => (out.push(c.id), walk(c.id)));
  walk(id);
  return out;
}
function depthOf(byId: Map<string, MindNode>, n: MindNode) {
  let d = 0;
  let cur = n;
  while (cur.parent && byId.get(cur.parent)) {
    d++;
    cur = byId.get(cur.parent)!;
  }
  return d;
}
/** A node's color: its own, else its nearest ancestor's, else its main branch's palette color. */
function colorOf(nodes: MindNode[], byId: Map<string, MindNode>, n: MindNode): string {
  let cur: MindNode | undefined = n;
  while (cur) {
    if (cur.color) return cur.color;
    const parent: MindNode | undefined = cur.parent ? byId.get(cur.parent) : undefined;
    if (parent && !parent.parent) {
      const i = childrenOf(nodes, parent.id).findIndex((c) => c.id === cur!.id);
      return PALETTE[i % PALETTE.length];
    }
    cur = parent;
  }
  return "var(--accent)";
}

/** Arrange the map as a balanced two-sided tree around the central topic. */
function tidy(nodes: MindNode[]): MindNode[] {
  const root = nodes.find((n) => !n.parent);
  if (!root) return nodes;
  const pos = new Map<string, { x: number; y: number }>();
  const size = new Map<string, number>();
  const measure = (id: string): number => {
    const kids = childrenOf(nodes, id);
    const s = kids.length ? kids.reduce((t, k) => t + measure(k.id), 0) : 1;
    size.set(id, s);
    return s;
  };
  measure(root.id);
  const place = (id: string, x: number, yCenter: number, dir: 1 | -1) => {
    pos.set(id, { x, y: yCenter });
    const kids = childrenOf(nodes, id);
    const total = kids.reduce((t, k) => t + size.get(k.id)!, 0) * ROW;
    let y = yCenter - total / 2;
    for (const k of kids) {
      const h = size.get(k.id)! * ROW;
      place(k.id, x + dir * GAP_X, y + h / 2, dir);
      y += h;
    }
  };
  pos.set(root.id, { x: 0, y: 0 });
  const kids = childrenOf(nodes, root.id);
  const right: MindNode[] = [];
  const left: MindNode[] = [];
  let r = 0;
  let l = 0;
  for (const k of kids) {
    const s = size.get(k.id)!;
    if (r <= l) {
      right.push(k);
      r += s;
    } else {
      left.push(k);
      l += s;
    }
  }
  for (const [side, dir, sum] of [[right, 1, r], [left, -1, l]] as const) {
    let y = (-sum * ROW) / 2;
    for (const k of side) {
      const h = size.get(k.id)! * ROW;
      place(k.id, dir * GAP_X, y + h / 2, dir);
      y += h;
    }
  }
  return nodes.map((n) => ({ ...n, ...(pos.get(n.id) ?? {}) }));
}

/* ---------- node rendering ---------- */

type Ctx = {
  editingId: string | null;
  setEditingId: (id: string | null) => void;
  setText: (id: string, text: string) => void;
  addChild: (id: string) => void;
  addSibling: (id: string) => void;
  remove: (id: string) => void;
  recolor: (id: string, color: string | undefined) => void;
};
const MindCtx = createContext<Ctx | null>(null);

type NodeData = { text: string; color: string; depth: number; isRoot: boolean };

const MindNodeView = memo(function MindNodeView({ id, data, selected }: NodeProps<Node<NodeData>>) {
  const ctx = useContext(MindCtx)!;
  const editing = ctx.editingId === id;
  const [draft, setDraft] = useState(data.text);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (editing) {
      setDraft(data.text);
      // React Flow keeps a brand-new node hidden until it is measured, so retry focusing briefly.
      let tries = 0;
      const tick = () => {
        const el = ref.current;
        if (el && document.activeElement !== el) {
          el.focus();
          el.select();
        }
        if ((!el || document.activeElement !== el) && tries++ < 20) setTimeout(tick, 25);
      };
      tick();
    }
  }, [editing, data.text]);
  const commit = () => {
    ctx.setText(id, draft.trim() || data.text || "Idea");
    ctx.setEditingId(null);
  };

  const c = data.color;
  const style: React.CSSProperties = data.isRoot
    ? { background: "var(--ink)", color: "var(--bg)" }
    : data.depth === 1
      ? { background: `color-mix(in srgb, ${c} 14%, var(--surface))`, borderColor: c, color: "var(--ink)" }
      : { background: "var(--surface)", borderColor: `color-mix(in srgb, ${c} 45%, var(--border))`, color: "var(--ink)" };
  const cls = data.isRoot
    ? "rounded-2xl px-6 py-3.5 text-[18px] font-semibold"
    : data.depth === 1
      ? "rounded-full border-2 px-4 py-2 text-[14px] font-medium"
      : "rounded-full border px-3.5 py-1.5 text-[13px]";

  return (
    <>
      <NodeToolbar isVisible={selected && !editing} position={Position.Top} offset={10}>
        <div className="flex items-center gap-1 rounded-full border border-line bg-surface px-1.5 py-1 shadow-lg">
          <button className="rounded-full px-2 py-1 text-[12px] text-muted hover:bg-sidebar hover:text-ink" onClick={() => ctx.addChild(id)} title="Add idea (Tab)">
            + Idea
          </button>
          {!data.isRoot && (
            <button className="rounded-full px-2 py-1 text-[12px] text-muted hover:bg-sidebar hover:text-ink" onClick={() => ctx.addSibling(id)} title="Add sibling (Enter)">
              + Sibling
            </button>
          )}
          {!data.isRoot && (
            <>
              <span className="mx-0.5 h-4 w-px bg-line" />
              {PALETTE.map((p) => (
                <button key={p} onClick={() => ctx.recolor(id, p)} className="h-4 w-4 rounded-full ring-offset-1 ring-offset-surface hover:ring-2 hover:ring-line" style={{ background: p }} aria-label={`Color ${p}`} />
              ))}
              <span className="mx-0.5 h-4 w-px bg-line" />
              <button className="rounded-full p-1 text-faint hover:bg-sidebar hover:text-bad" onClick={() => ctx.remove(id)} title="Delete (Backspace)" aria-label="Delete">
                <Icon name="trash" size={13} />
              </button>
            </>
          )}
        </div>
      </NodeToolbar>
      <Handle type="target" position={Position.Left} id="l" className="!opacity-0 !pointer-events-none" />
      <Handle type="target" position={Position.Right} id="r" className="!opacity-0 !pointer-events-none" />
      <Handle type="source" position={Position.Left} id="sl" className="!opacity-0 !pointer-events-none" />
      <Handle type="source" position={Position.Right} id="sr" className="!opacity-0 !pointer-events-none" />
      <div
        className={`max-w-[240px] text-center leading-snug shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-shadow ${cls} ${selected ? "ring-2 ring-accent ring-offset-2 ring-offset-bg" : ""}`}
        style={style}
        onDoubleClick={() => ctx.setEditingId(id)}
      >
        {editing ? (
          <textarea
            ref={ref}
            rows={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                commit();
              }
              if (e.key === "Escape") ctx.setEditingId(null);
            }}
            className="nodrag block w-[180px] resize-none bg-transparent text-center outline-none [field-sizing:content]"
          />
        ) : (
          <span className="whitespace-pre-wrap break-words">{data.text}</span>
        )}
      </div>
    </>
  );
});

const nodeTypes = { mind: MindNodeView };

/* ---------- editor ---------- */

function useDark() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const el = document.documentElement;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const read = () => setDark(el.dataset.theme === "dark" || (el.dataset.theme !== "light" && mq.matches));
    read();
    const mo = new MutationObserver(read);
    mo.observe(el, { attributes: true, attributeFilter: ["data-theme"] });
    mq.addEventListener("change", read);
    return () => (mo.disconnect(), mq.removeEventListener("change", read));
  }, []);
  return dark;
}

function Editor({ map, onChange }: { map: MindMap; onChange: (nodes: MindNode[]) => void }) {
  const [nodes, setNodes] = useState<MindNode[]>(map.nodes);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const rf = useReactFlow();
  const dark = useDark();

  // Changes that should be saved flip `dirty`; the effect below hands them to the parent after render.
  const dirty = useRef(false);
  const commit = useCallback((fn: (ns: MindNode[]) => MindNode[]) => {
    dirty.current = true;
    setNodes(fn);
  }, []);
  useEffect(() => {
    if (!dirty.current) return;
    dirty.current = false;
    onChange(nodes);
  }, [nodes, onChange]);

  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const root = nodes.find((n) => !n.parent);

  const add = useCallback(
    (parentId: string) => {
      const id = uid();
      commit((ns) => {
        const parent = ns.find((n) => n.id === parentId);
        if (!parent) return ns;
        const rootN = ns.find((n) => !n.parent)!;
        const kids = childrenOf(ns, parentId);
        let dir: 1 | -1 = parent.x < rootN.x ? -1 : 1;
        if (parent.id === rootN.id) {
          const r = kids.filter((k) => k.x >= rootN.x).length;
          dir = r <= kids.length - r ? 1 : -1;
        }
        const sideKids = parent.id === rootN.id ? kids.filter((k) => (dir === 1 ? k.x >= rootN.x : k.x < rootN.x)) : kids;
        const y = sideKids.length ? Math.max(...sideKids.map((k) => k.y)) + ROW : parent.y;
        const node = { id, text: "New idea", x: parent.x + dir * GAP_X, y, parent: parentId };
        // Keep the new idea on screen.
        setTimeout(() => {
          const el = document.querySelector(".mindmap");
          if (!el) return;
          const r = el.getBoundingClientRect();
          const pt = rf.flowToScreenPosition({ x: node.x, y: node.y });
          if (pt.x < r.left + 120 || pt.x > r.right - 120 || pt.y < r.top + 60 || pt.y > r.bottom - 60)
            rf.setCenter(node.x, node.y, { zoom: rf.getZoom(), duration: 300 });
        }, 30);
        return [...ns, node];
      });
      setSelectedId(id);
      setEditingId(id);
    },
    [commit, rf],
  );

  const ctx: Ctx = useMemo(
    () => ({
      editingId,
      setEditingId,
      setText: (id, text) => commit((ns) => ns.map((n) => (n.id === id ? { ...n, text } : n))),
      addChild: add,
      addSibling: (id) => {
        const n = byId.get(id);
        if (n?.parent) add(n.parent);
      },
      remove: (id) => {
        const n = byId.get(id);
        if (!n?.parent) return;
        commit((ns) => {
          const gone = new Set([id, ...descendants(ns, id)]);
          return ns.filter((x) => !gone.has(x.id));
        });
        setSelectedId(n.parent);
      },
      recolor: (id, color) => commit((ns) => ns.map((n) => (n.id === id ? { ...n, color } : n))),
    }),
    [editingId, commit, add, byId],
  );

  // Keyboard: Tab = new idea, Enter = sibling, Backspace/Delete = remove, F2/Space = rename.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (!selectedId || editingId || t.closest("input, textarea, [contenteditable=true], select")) return;
      if (e.key === "Tab") {
        e.preventDefault();
        ctx.addChild(selectedId);
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (byId.get(selectedId)?.parent) ctx.addSibling(selectedId);
        else ctx.addChild(selectedId);
      } else if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        ctx.remove(selectedId);
      } else if (e.key === "F2" || e.key === " ") {
        e.preventDefault();
        setEditingId(selectedId);
      } else if (e.key === "Escape") setSelectedId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, editingId, ctx, byId]);

  const rfNodes: Node<NodeData>[] = useMemo(
    () =>
      nodes.map((n) => ({
        id: n.id,
        type: "mind",
        position: { x: n.x, y: n.y },
        selected: n.id === selectedId,
        data: { text: n.text, color: colorOf(nodes, byId, n), depth: depthOf(byId, n), isRoot: !n.parent },
      })),
    [nodes, byId, selectedId],
  );

  const rfEdges: Edge[] = useMemo(
    () =>
      nodes
        .filter((n) => n.parent && byId.has(n.parent))
        .map((n) => {
          const p = byId.get(n.parent!)!;
          const left = n.x < p.x;
          const d = depthOf(byId, n);
          return {
            id: `${p.id}-${n.id}`,
            source: p.id,
            target: n.id,
            sourceHandle: left ? "sl" : "sr",
            targetHandle: left ? "r" : "l",
            type: "default",
            selectable: false,
            style: { stroke: colorOf(nodes, byId, n), strokeWidth: d === 1 ? 3 : 2, opacity: 0.85 },
          };
        }),
    [nodes, byId],
  );

  const onNodesChange = useCallback(
    (changes: NodeChange<Node<NodeData>>[]) => {
      const moves = changes.filter((c) => c.type === "position" && c.position);
      if (!moves.length) return;
      const update = (ns: MindNode[]) => {
        let next = ns;
        for (const c of moves) {
          if (c.type !== "position" || !c.position) continue;
          const me = next.find((n) => n.id === c.id);
          if (!me) continue;
          const dx = c.position.x - me.x;
          const dy = c.position.y - me.y;
          // Moving an idea carries its whole branch with it.
          const group = new Set([c.id, ...descendants(next, c.id)]);
          next = next.map((n) => (group.has(n.id) ? { ...n, x: n.x + dx, y: n.y + dy } : n));
        }
        return next;
      };
      const done = moves.some((c) => c.type === "position" && c.dragging === false);
      if (done) commit(update);
      else setNodes(update);
    },
    [commit],
  );

  return (
    <MindCtx.Provider value={ctx}>
      <div className="relative h-full">
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          nodeTypes={nodeTypes}
          nodeOrigin={[0.5, 0.5]}
          onNodesChange={onNodesChange}
          onNodeDragStop={() => commit((ns) => ns)}
          onNodeClick={(_, n) => setSelectedId(n.id)}
          onPaneClick={() => {
            setSelectedId(null);
            setEditingId(null);
          }}
          deleteKeyCode={null}
          selectionKeyCode={null}
          multiSelectionKeyCode={null}
          nodesConnectable={false}
          colorMode={dark ? "dark" : "light"}
          fitView
          fitViewOptions={{ padding: 0.3, maxZoom: 1.2 }}
          minZoom={0.2}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
          className="mindmap"
        >
          <Background gap={22} size={1.2} color="var(--border)" />
          <Controls showInteractive={false} position="bottom-left" />
        </ReactFlow>
        <div className="pointer-events-none absolute bottom-4 left-1/2 hidden -translate-x-1/2 rounded-full border border-line bg-surface/90 px-3 py-1 text-[12px] text-faint shadow-sm backdrop-blur md:block">
          Click an idea, then <b className="font-medium text-muted">Tab</b> adds a branch, <b className="font-medium text-muted">Enter</b> a sibling, double-click to rename
        </div>
        <div className="absolute right-4 top-4 flex gap-2">
          <button
            className="btn border border-line bg-surface shadow-sm"
            onClick={() => {
              commit((ns) => tidy(ns));
              setTimeout(() => rf.fitView({ padding: 0.3, maxZoom: 1.2, duration: 400 }), 30);
            }}
            title="Arrange everything neatly"
          >
            <Icon name="spark" size={14} /> Tidy up
          </button>
          {root && (
            <button className="btn border border-line bg-surface shadow-sm" onClick={() => ctx.addChild(selectedId ?? root.id)}>
              <Icon name="plus" size={14} /> Idea
            </button>
          )}
        </div>
      </div>
    </MindCtx.Provider>
  );
}

/* ---------- page: list of maps + canvas ---------- */

export function MindMapStudio({ initial }: { initial: MindMap[] }) {
  const [maps, setMaps] = useState(initial);
  const [activeId, setActiveId] = useState<string | null>(initial[0]?.id ?? null);
  const [saving, setSaving] = useState<"" | "saving" | "saved">("");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const active = maps.find((m) => m.id === activeId);

  const save = (id: string, patch: Partial<Pick<MindMap, "title" | "nodes">>) => {
    setMaps((ms) => ms.map((m) => (m.id === id ? { ...m, ...patch } : m)));
    setSaving("saving");
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      await fetch(`/api/mindmaps/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
      setSaving("saved");
    }, 600);
  };

  const saveRef = useRef(save);
  saveRef.current = save;
  const onNodesSaved = useCallback((nodes: MindNode[]) => activeId && saveRef.current(activeId, { nodes }), [activeId]);

  const create = async () => {
    const r = await fetch("/api/mindmaps", { method: "POST", body: JSON.stringify({ title: "New mind map" }) });
    const m = (await r.json()) as MindMap;
    setMaps((ms) => [m, ...ms]);
    setActiveId(m.id);
  };

  const removeMap = async (m: MindMap) => {
    if (!confirm(`Delete "${m.title}"? This can't be undone.`)) return;
    setMaps((ms) => ms.filter((x) => x.id !== m.id));
    if (activeId === m.id) setActiveId(maps.find((x) => x.id !== m.id)?.id ?? null);
    await fetch(`/api/mindmaps/${m.id}`, { method: "DELETE" });
  };

  return (
    <div className="flex h-full">
      <div className="hidden w-60 shrink-0 flex-col border-r border-line md:flex">
        <div className="flex items-center justify-between px-4 pt-6 pb-3">
          <h1 className="text-[20px]">Mind maps</h1>
          <button onClick={create} className="rounded-md p-1.5 text-muted hover:bg-sidebar hover:text-accent" aria-label="New mind map" title="New mind map">
            <Icon name="plus" size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto scroll-thin px-2 pb-4">
          {maps.map((m) => (
            <div key={m.id} className={`group flex items-center rounded-lg ${m.id === activeId ? "bg-surface border border-line" : "border border-transparent hover:bg-surface/60"}`}>
              <button onClick={() => setActiveId(m.id)} className="min-w-0 flex-1 px-3 py-2 text-left">
                <div className="truncate text-[14px]">{m.title}</div>
                <div className="text-[11px] text-faint">{m.nodes.length} ideas</div>
              </button>
              <button onClick={() => removeMap(m)} className="mr-1 rounded-md p-1.5 text-faint opacity-0 hover:text-bad group-hover:opacity-100" aria-label={`Delete ${m.title}`}>
                <Icon name="trash" size={13} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        {active ? (
          <>
            <div className="flex items-center gap-3 border-b border-line px-5 py-3">
              <input
                key={active.id}
                defaultValue={active.title}
                onBlur={(e) => e.target.value.trim() !== active.title && save(active.id, { title: e.target.value.trim() || "Untitled map" })}
                onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                className="min-w-0 flex-1 bg-transparent text-[18px] font-semibold outline-none"
                aria-label="Map title"
              />
              <span className="text-[12px] text-faint">{saving === "saving" ? "Saving…" : saving === "saved" ? "Saved" : ""}</span>
              <button onClick={create} className="btn btn-ghost md:hidden"><Icon name="plus" size={14} /> New</button>
            </div>
            <div className="min-h-0 flex-1">
              <ReactFlowProvider key={active.id}>
                <Editor map={active} onChange={onNodesSaved} />
              </ReactFlowProvider>
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <span className="text-faint"><Icon name="map" size={34} /></span>
            <h2 className="mt-3 text-[22px]">Map out an idea</h2>
            <p className="mt-1 max-w-sm text-muted">Start with a central topic, branch out with Tab, and drag things wherever you like.</p>
            <button onClick={create} className="btn btn-primary mt-5"><Icon name="plus" size={14} /> New mind map</button>
          </div>
        )}
      </div>
    </div>
  );
}
