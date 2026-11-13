"use client";
import { useEffect, useState } from "react";

// 5x7 dot-matrix glyphs, one string per row ("1" = lit).
const GLYPHS: Record<string, string[]> = {
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  ":": ["0", "0", "1", "0", "1", "0", "0"],
  " ": ["0", "0", "0", "0", "0", "0", "0"],
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
};

const PX = 3; // size of one dot
const GAP = 1; // space between dots

function Glyph({ ch, x, color, dim }: { ch: string; x: number; color: string; dim: string }) {
  const rows = GLYPHS[ch] ?? GLYPHS[" "];
  return (
    <g transform={`translate(${x} 0)`}>
      {rows.flatMap((row, r) =>
        [...row].map((bit, c) => (
          <rect key={`${r}-${c}`} x={c * (PX + GAP)} y={r * (PX + GAP)} width={PX} height={PX} rx={0.6} fill={bit === "1" ? color : dim} />
        )),
      )}
    </g>
  );
}

/** Live dot-matrix clock: HH:MM:SS with AM/PM, blinking colons. */
export function PixelClock({ fluid = false }: { fluid?: boolean }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!now) return <div className={fluid ? "h-[40px] w-full" : "h-[28px] w-[200px]"} />;

  const h = now.getHours();
  const hh = String(h % 12 || 12).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  const blink = now.getSeconds() % 2 === 0;
  const chars = [...hh, blink ? ":" : " ", ...mm, blink ? ":" : " ", ...ss];
  const ampm = h < 12 ? "AM" : "PM";

  const digitW = 5 * (PX + GAP);
  const colonW = 1 * (PX + GAP);
  let x = 0;
  const placed = chars.map((ch, i) => {
    const isColon = i === 2 || i === 5;
    const at = x;
    x += (isColon ? colonW : digitW) + 3;
    return { ch, at, isColon };
  });
  const timeW = x;
  const smallScale = 0.6;
  const width = timeW + 6 + 2 * digitW * smallScale + 4;
  const height = 7 * (PX + GAP);

  return (
    <div
      className={`flex items-center justify-center rounded-lg border border-line bg-[var(--clock-bg)] px-2.5 py-2 shadow-[var(--clock-shadow)] ${fluid ? "w-full" : ""}`}
      title={now.toLocaleString(undefined, { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" })}
    >
      <svg width={fluid ? "100%" : width} height={fluid ? undefined : height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${hh}:${mm}:${ss} ${ampm}`} style={{ filter: "var(--clock-glow)" }}>
        {placed.map((p, i) => (
          <Glyph key={i} ch={p.ch} x={p.at} color="var(--clock-on)" dim="var(--clock-off)" />
        ))}
        <g transform={`translate(${timeW + 6} ${height * (1 - smallScale)}) scale(${smallScale})`}>
          <Glyph ch={ampm[0]} x={0} color="var(--clock-on)" dim="var(--clock-off)" />
          <Glyph ch={ampm[1]} x={digitW + 3} color="var(--clock-on)" dim="var(--clock-off)" />
        </g>
      </svg>
    </div>
  );
}
