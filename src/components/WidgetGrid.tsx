"use client";
import { useRef, useState } from "react";
import { Responsive, WidthProvider, type Layout, type Layouts } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

const Grid = WidthProvider(Responsive);
const BREAKPOINTS = { lg: 680, sm: 0 };
const COLS = { lg: 12, sm: 1 };
const ROW = 40;

export interface Widget {
  id: string;
  title?: React.ReactNode;
  /** Extra controls on the right of the title bar. */
  extra?: React.ReactNode;
  /** Position on the 12-column grid. */
  at: { x: number; y: number; w: number; h: number; minW?: number; minH?: number };
  /** Height on phones (one column). */
  smH?: number;
  /** Cards like stat tiles draw their own label and keep tight padding. */
  bare?: boolean;
  children: React.ReactNode;
}

function defaults(widgets: Widget[]): Layouts {
  let y = 0;
  return {
    lg: widgets.map((w) => ({ i: w.id, ...w.at, minW: w.at.minW ?? 2, minH: w.at.minH ?? 2 })),
    sm: [...widgets]
      .sort((a, b) => a.at.y - b.at.y || a.at.x - b.at.x)
      .map((w) => {
        const h = w.smH ?? w.at.h;
        const l: Layout = { i: w.id, x: 0, y, w: 1, h, minH: 2 };
        y += h;
        return l;
      }),
  };
}

/** Keep a saved layout usable: every current widget present exactly once, new ones in their default spot. */
function normalize(saved: Layouts | null | undefined, defs: Layouts): Layouts {
  const out: Layouts = {};
  for (const bp of Object.keys(defs)) {
    const mine = saved && Array.isArray(saved[bp]) ? saved[bp] : [];
    out[bp] = defs[bp].map((d) => {
      const m = mine.find((l) => l.i === d.i);
      return m ? { ...d, x: m.x, y: m.y, w: m.w, h: m.h } : d;
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
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const persist = (next: Layouts) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      fetch(`/api/prefs/${prefKey}`, { method: "PUT", body: JSON.stringify({ value: next }) });
    }, 400);
  };
  const isDefault = JSON.stringify(layouts) === JSON.stringify(defs);
  const save = () => setTimeout(() => setLayouts((l) => { persist(l); return l; }));

  return (
    <div>
      <div className="flex justify-end gap-3 px-2 text-[12px] text-faint">
        <span className="hidden lg:inline">Drag a card by its top, resize from its edges.</span>
        {!isDefault && (
          <button onClick={() => { setLayouts(defs); persist(defs); }} className="hover:text-accent">
            Reset layout
          </button>
        )}
      </div>
      <Grid
        layouts={layouts}
        breakpoints={BREAKPOINTS}
        cols={COLS}
        rowHeight={ROW}
        margin={[12, 12]}
        containerPadding={[0, 8]}
        draggableHandle=".widget-handle"
        draggableCancel="button, a, input, select, textarea, [contenteditable]"
        resizeHandles={["se", "e", "s"]}
        onLayoutChange={(_cur, all) => setLayouts(normalize(all, defs))}
        onDragStop={save}
        onResizeStop={save}
      >
        {widgets.map((w) => (
          <div key={w.id} className={`card flex flex-col overflow-hidden ${w.bare ? "" : "p-4"}`}>
            {w.bare ? (
              <div className="widget-handle h-full cursor-move">{w.children}</div>
            ) : (
              <>
                <div className="widget-handle mb-2 flex cursor-move select-none items-center gap-2">
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
