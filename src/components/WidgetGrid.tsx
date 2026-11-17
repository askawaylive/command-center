"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Responsive, WidthProvider, type Layout, type Layouts } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

const Grid = WidthProvider(Responsive);
const BREAKPOINTS = { lg: 680, sm: 0 };
const COLS = { lg: 12, sm: 2 };
const ROW = 40;

export interface Widget {
  id: string;
  title?: React.ReactNode;
  /** Extra controls on the right of the title bar. */
  extra?: React.ReactNode;
  /** Position on the 12-column grid. */
  at: { x: number; y: number; w: number; h: number; minW?: number; minH?: number };
  /** Height on phones. */
  smH?: number;
  /** Half width on phones (two small cards side by side). */
  half?: boolean;
  /** Moves but can't be resized: full width, and its height follows its content. */
  fit?: boolean;
  /** Cards like stat tiles draw their own label and keep tight padding. */
  bare?: boolean;
  children: React.ReactNode;
}

function defaults(widgets: Widget[]): Layouts {
  let y = 0;
  return {
    lg: widgets.map((w) => ({ i: w.id, ...w.at, minW: w.at.minW ?? 2, minH: w.at.minH ?? 2, ...(w.fit ? { isResizable: false, w: 12, x: 0 } : {}) })),
    sm: (() => {
      // Phones: two columns. Half-width cards pair up side by side; everything else spans both.
      let col = 0;
      let rowH = 0;
      return [...widgets]
        .sort((a, b) => a.at.y - b.at.y || a.at.x - b.at.x)
        .map((w) => {
          const h = w.smH ?? w.at.h;
          if (col === 1 && !w.half) {
            y += rowH;
            col = 0;
          }
          const l: Layout = { i: w.id, x: w.half ? col : 0, y, w: w.half ? 1 : 2, h, minH: 2, ...(w.fit ? { isResizable: false } : {}) };
          if (w.half && col === 0) {
            col = 1;
            rowH = h;
          } else {
            y += Math.max(h, w.half ? rowH : 0);
            col = 0;
          }
          return l;
        });
    })(),
  };
}

/** Measures its content and reports how many grid rows the card needs to show all of it. */
function Fit({ id, onRows, children }: { id: string; onRows: (id: string, rows: number) => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Card height = rows*ROW + (rows-1)*12; it also holds the title bar (~30px) and 16px padding top and bottom.
    const ro = new ResizeObserver(() => onRows(id, Math.max(4, Math.ceil((el.scrollHeight + 30 + 32 + 12) / (ROW + 12)))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [id, onRows]);
  return <div ref={ref}>{children}</div>;
}

/** Keep a saved layout usable: every current widget present exactly once, new ones in their default spot. */
function normalize(saved: Layouts | null | undefined, defs: Layouts): Layouts {
  const out: Layouts = {};
  for (const bp of Object.keys(defs)) {
    // Phone layouts can't be edited, so they always follow the desktop order.
    const mine = bp !== "sm" && saved && Array.isArray(saved[bp]) ? saved[bp] : [];
    out[bp] = defs[bp].map((d) => {
      const m = mine.find((l) => l.i === d.i);
      return m ? { ...d, x: d.isResizable === false ? d.x : m.x, y: m.y, w: d.isResizable === false ? d.w : m.w, h: d.isResizable === false ? d.h : m.h } : d;
    });
  }
  return out;
}

/**
 * A dashboard of cards you can drag by their title and resize from the edges or corner.
 * The arrangement is saved under `prefKey` so it follows you across devices.
 */
export function WidgetGrid({ widgets, prefKey, saved }: { widgets: Widget[]; prefKey: string; saved?: Layouts | null }) {
  const defs = defaults(widgets);
  const [layouts, setLayouts] = useState<Layouts>(() => normalize(saved, defs));
  // Phones scroll the page with a finger, so cards don't move or resize there.
  const [bp, setBp] = useState("lg");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const persist = (next: Layouts) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      fetch(`/api/prefs/${prefKey}`, { method: "PUT", body: JSON.stringify({ value: next }) });
    }, 400);
  };
  const isDefault = JSON.stringify(layouts) === JSON.stringify(defs);
  // Cards that fit their content get their height from what they show, not from the saved layout.
  const [rows, setRowsState] = useState<Record<string, number>>({});
  const setRows = useCallback((id: string, n: number) => setRowsState((r) => (r[id] === n ? r : { ...r, [id]: n })), []);
  const shown: Layouts = Object.fromEntries(
    Object.entries(layouts).map(([bp, list]) => [bp, list.map((l) => (rows[l.i] ? { ...l, h: rows[l.i], minH: rows[l.i], maxH: rows[l.i] } : l))]),
  );
  const save = () => setTimeout(() => setLayouts((l) => { persist(l); return l; }));

  return (
    <div>
      <div className="flex justify-end gap-3 px-2 text-[12px] text-faint">
        <span className="hidden lg:inline">Drag a card by its top, resize from its edges or corner.</span>
        {!isDefault && (
          <button onClick={() => { setLayouts(defs); persist(defs); }} className="hover:text-accent">
            Reset layout
          </button>
        )}
      </div>
      <Grid
        layouts={shown}
        breakpoints={BREAKPOINTS}
        cols={COLS}
        rowHeight={ROW}
        margin={[12, 12]}
        containerPadding={[0, 8]}
        onBreakpointChange={setBp}
        isDraggable={bp === "lg"}
        isResizable={bp === "lg"}
        draggableHandle=".widget-handle"
        draggableCancel="button, a, input, select, textarea, [contenteditable]"
        resizeHandles={["se", "e", "s"]}
        onLayoutChange={(_cur, all) => setLayouts(normalize(all, defs))}
        onDragStop={save}
        onResizeStop={save}
      >
        {widgets.map((w) => (
          <div key={w.id} className={`card flex flex-col overflow-hidden ${w.bare ? "" : "p-4"}`}>
            {w.fit ? (
              <>
                <div className={`widget-handle mb-2 flex select-none items-center gap-2 ${bp === "lg" ? "cursor-move" : ""}`}>
                  <h2 className="min-w-0 flex-1 truncate text-[14px] font-semibold">{w.title}</h2>
                  {w.extra}
                </div>
                <Fit id={w.id} onRows={setRows}>{w.children}</Fit>
              </>
            ) : w.bare ? (
              <div className={`widget-handle h-full ${bp === "lg" ? "cursor-move" : ""}`}>{w.children}</div>
            ) : (
              <>
                <div className={`widget-handle mb-2 flex select-none items-center gap-2 ${bp === "lg" ? "cursor-move" : ""}`}>
                  <h2 className="min-w-0 flex-1 truncate text-[14px] font-semibold">{w.title}</h2>
                  {w.extra}
                </div>
                <div className="min-h-0 flex-1 overflow-auto scroll-thin">{w.children}</div>
              </>
            )}
          </div>
        ))}
      </Grid>
    </div>
  );
}
