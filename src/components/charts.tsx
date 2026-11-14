"use client";
import { useEffect, useRef, useState } from "react";

/** Live pixel size of an element, so charts draw at real size (text stays small however big the card is). */
export function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: Math.round(e.contentRect.width), h: Math.round(e.contentRect.height) }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

export type Point = { date: string; value: number };

const shortMoney = (v: number) => (v >= 1000 ? `$${(v / 1000).toFixed(v % 1000 ? 1 : 0)}k` : `$${Math.round(v * 100) / 100}`);
const fullMoney = (v: number) => `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const label = (iso: string) => new Date(iso + "T00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });

function niceTop(max: number) {
  if (max <= 0) return 10;
  const p = Math.pow(10, Math.floor(Math.log10(max)));
  const n = max / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

/** Shopify-style line chart that fills its box: small axis labels, soft area, hover readout. */
export function LineChart({ points, color = "var(--accent)" }: { points: Point[]; color?: string }) {
  const [ref, { w, h }] = useSize<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const top = niceTop(Math.max(0, ...points.map((p) => p.value)));
  const padL = 40, padR = 8, padT = 8, padB = 22;
  const pw = Math.max(1, w - padL - padR);
  const ph = Math.max(1, h - padT - padB);
  const x = (i: number) => padL + (points.length > 1 ? (i / (points.length - 1)) * pw : pw / 2);
  const y = (v: number) => padT + ph - (v / top) * ph;
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join("");
  const area = points.length ? `${line}L${x(points.length - 1)},${padT + ph}L${x(0)},${padT + ph}Z` : "";
  const ticks = [0, top / 2, top];
  const every = Math.max(1, Math.ceil(points.length / Math.max(2, Math.floor(pw / 70))));

  return (
    <div ref={ref} className="relative h-full w-full min-h-[80px]">
      {w > 0 && h > 0 && (
        <svg width={w} height={h} className="block" onMouseLeave={() => setHover(null)}
          onMouseMove={(e) => {
            const r = (e.currentTarget as SVGElement).getBoundingClientRect();
            const i = Math.round(((e.clientX - r.left - padL) / pw) * (points.length - 1));
            setHover(i >= 0 && i < points.length ? i : null);
          }}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={padL} x2={w - padR} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeDasharray={t ? "2 3" : undefined} />
              <text x={padL - 6} y={y(t) + 3.5} textAnchor="end" fontSize={11} fill="var(--faint)">{shortMoney(t)}</text>
            </g>
          ))}
          {points.map((p, i) => (i % every === 0 && points.length - 1 - i >= every) || i === points.length - 1 ? (
            <text key={p.date} x={x(i)} y={h - 6} textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"} fontSize={11} fill="var(--faint)">{label(p.date)}</text>
          ) : null)}
          <path d={area} fill={color} opacity={0.08} />
          <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {hover !== null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={padT} y2={padT + ph} stroke="var(--faint)" strokeDasharray="2 3" />
              <circle cx={x(hover)} cy={y(points[hover].value)} r={4} fill={color} stroke="var(--surface)" strokeWidth={2} />
            </g>
          )}
        </svg>
      )}
      {hover !== null && points[hover] && (
        <div className="pointer-events-none absolute top-0 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[12px] shadow-md"
          style={{ left: Math.min(Math.max(0, x(hover) - 50), Math.max(0, w - 110)) }}>
          <div className="text-muted">{label(points[hover].date)}</div>
          <div className="font-medium tabular-nums">{fullMoney(points[hover].value)}</div>
        </div>
      )}
    </div>
  );
}

/** Tiny trend line for a stat card. */
export function Sparkline({ values, color = "var(--accent)" }: { values: number[]; color?: string }) {
  const W = 64, H = 24;
  const max = Math.max(...values, 0);
  if (!values.length) return null;
  const pts = values.map((v, i) => `${((i / Math.max(1, values.length - 1)) * W).toFixed(1)},${(max ? H - 2 - (v / max) * (H - 4) : H - 2).toFixed(1)}`).join(" ");
  return (
    <svg width={W} height={H} className="shrink-0" aria-hidden>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" opacity={0.8} />
    </svg>
  );
}
