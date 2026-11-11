"use client";
import { useState } from "react";
import type { Business, BusinessMetrics } from "@/lib/types";

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;

/** Stacked daily revenue bars, one segment per business, with a hover tooltip. */
export function RevenueChart({ metrics, businesses, height = 220 }: { metrics: BusinessMetrics[]; businesses: Business[]; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const days = metrics[0]?.daily.map((d) => d.date) ?? [];
  const order = businesses.filter((b) => metrics.some((m) => m.businessId === b.id));
  const totals = days.map((_, i) => metrics.reduce((s, m) => s + (m.daily[i]?.revenue ?? 0), 0));
  const max = Math.max(1, ...totals);
  const nice = Math.pow(10, Math.floor(Math.log10(max)));
  const top = Math.ceil(max / nice) * nice;
  const W = 760;
  const H = height;
  const padL = 44;
  const padB = 22;
  const plotH = H - padB - 8;
  const bw = (W - padL) / days.length;
  const y = (v: number) => (v / top) * plotH;
  const ticks = [0, top / 2, top];

  return (
    <div className="relative">
      <div className="mb-3 flex flex-wrap gap-4 text-[12px] text-muted">
        {order.map((b) => (
          <span key={b.id} className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: b.color }} />
            {b.name}
          </span>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Daily revenue by business, last 30 days" onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W} y1={8 + plotH - y(t)} y2={8 + plotH - y(t)} stroke="var(--border)" strokeWidth={1} />
            <text x={padL - 8} y={8 + plotH - y(t) + 4} textAnchor="end" fontSize={11} fill="var(--faint)">
              {t >= 1000 ? `$${(t / 1000).toFixed(t % 1000 ? 1 : 0)}k` : `$${t}`}
            </text>
          </g>
        ))}
        {days.map((d, i) => {
          let base = 8 + plotH;
          const x = padL + i * bw + 2;
          const w = Math.max(2, bw - 4);
          return (
            <g key={d} onMouseEnter={() => setHover(i)}>
              {order.map((b, si) => {
                const v = metrics.find((m) => m.businessId === b.id)?.daily[i]?.revenue ?? 0;
                const h = y(v);
                if (h <= 0) return null;
                const gap = si === 0 ? 0 : 2; // 2px surface gap between stacked segments
                base -= h;
                const isTop = si === order.length - 1;
                return (
                  <rect
                    key={b.id}
                    x={x}
                    y={base}
                    width={w}
                    height={Math.max(0, h - gap)}
                    rx={isTop ? 3 : 0}
                    fill={b.color}
                    opacity={hover === null || hover === i ? 1 : 0.45}
                  />
                );
              })}
              <rect x={padL + i * bw} y={0} width={bw} height={H - padB} fill="transparent" />
              {(i % 5 === 0 || i === days.length - 1) && (
                <text x={i === days.length - 1 ? W : x + w / 2} y={H - 6} textAnchor={i === days.length - 1 ? "end" : "middle"} fontSize={11} fill="var(--faint)">
                  {new Date(d + "T00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <div
          className="pointer-events-none absolute top-8 card px-3 py-2 text-[12px] shadow-lg min-w-[170px]"
          style={{ left: `min(calc(${((padL + hover * bw) / W) * 100}% + 12px), calc(100% - 180px))` }}
        >
          <div className="font-medium text-ink mb-1">
            {new Date(days[hover] + "T00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
          </div>
          {[...order].reverse().map((b) => (
            <div key={b.id} className="flex items-center gap-2 text-muted">
              <span className="h-2 w-2 rounded-[2px]" style={{ background: b.color }} />
              <span className="flex-1">{b.name}</span>
              <span className="tabular-nums text-ink">{money(metrics.find((m) => m.businessId === b.id)?.daily[hover]?.revenue ?? 0)}</span>
            </div>
          ))}
          <div className="mt-1 flex justify-between border-t border-line pt-1 text-ink">
            <span>Total</span>
            <span className="tabular-nums font-medium">{money(totals[hover])}</span>
          </div>
        </div>
      )}
    </div>
  );
}
