"use client";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Column widths for a table whose columns can be dragged wider or narrower.
 * Widths are saved under the given pref key so they follow Scott across devices.
 */
export function useColumnWidths(prefKey: string, defaults: Record<string, number>) {
  const [widths, setWidths] = useState<Record<string, number>>(defaults);
  const latest = useRef(widths);
  latest.current = widths;

  useEffect(() => {
    let live = true;
    fetch(`/api/prefs/${prefKey}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { value?: Record<string, number> | null } | null) => {
        if (live && d?.value && typeof d.value === "object") setWidths((w) => ({ ...w, ...d.value }));
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [prefKey]);

  const save = useCallback(
    (next: Record<string, number>) => fetch(`/api/prefs/${prefKey}`, { method: "PUT", body: JSON.stringify({ value: next }) }).catch(() => {}),
    [prefKey],
  );

  /** Pointer-down handler for the grip on a column's right edge. */
  const startResize = useCallback(
    (key: string) => (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const x0 = e.clientX;
      const w0 = latest.current[key] ?? defaults[key] ?? 100;
      const move = (ev: PointerEvent) => setWidths((w) => ({ ...w, [key]: Math.max(56, Math.round(w0 + ev.clientX - x0)) }));
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        document.body.style.cursor = "";
        save(latest.current);
      };
      document.body.style.cursor = "col-resize";
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [save],
  );

  const reset = useCallback(
    (key: string) => {
      setWidths((w) => {
        const next = { ...w, [key]: defaults[key] };
        save(next);
        return next;
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [save],
  );

  return { widths, startResize, reset };
}

/** The grip drawn on a header cell's right edge. Drag to resize, double-click to reset. */
export function ColumnGrip({ onPointerDown, onReset }: { onPointerDown: (e: React.PointerEvent) => void; onReset: () => void }) {
  return (
    <span
      role="separator"
      aria-orientation="vertical"
      title="Drag to resize · double-click to reset"
      onPointerDown={onPointerDown}
      onDoubleClick={onReset}
      onClick={(e) => e.stopPropagation()}
      className="group absolute -right-1.5 top-0 z-10 flex h-full w-3 cursor-col-resize touch-none justify-center"
    >
      <span className="my-2 w-px bg-line group-hover:w-0.5 group-hover:bg-accent" />
    </span>
  );
}
