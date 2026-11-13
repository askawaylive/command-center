export const money = (n: number) => `$${Math.round(n).toLocaleString()}`;

export function SampleBadge({ live }: { live: boolean }) {
  if (live) return <span className="rounded-md bg-sidebar px-1.5 py-0.5 text-[11px] text-good">Live</span>;
  return (
    <span className="rounded-md bg-sidebar px-1.5 py-0.5 text-[11px] text-faint" title="Add this account's key on the Connections page to see real numbers">
      Not connected
    </span>
  );
}

export function Delta({ now, prev }: { now: number; prev: number }) {
  if (!prev) return null;
  const pct = ((now - prev) / prev) * 100;
  const up = pct >= 0;
  return (
    <span className={`text-[12px] tabular-nums ${up ? "text-good" : "text-bad"}`}>
      {up ? "↑" : "↓"} {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

export function Stat({ label, value, sub }: { label: string; value: string; sub?: React.ReactNode }) {
  return (
    <div className="card p-4">
      <div className="text-[12px] text-muted">{label}</div>
      <div className="mt-1 font-serif text-[28px] leading-none tabular-nums">{value}</div>
      {sub && <div className="mt-2 text-[12px] text-muted">{sub}</div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3 px-8 pt-8 pb-6">
      <div>
        <h1 className="font-serif text-[32px] leading-tight tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-[15px] text-muted">{subtitle}</p>}
      </div>
      {children}
    </header>
  );
}
