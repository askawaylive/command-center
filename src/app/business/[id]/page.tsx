import Link from "next/link";
import { notFound } from "next/navigation";
import { BizMark } from "@/components/BizMark";
import { getBusiness, getBusinesses } from "@/lib/businesses";
import { getEmails, getMetrics } from "@/lib/data";
import { listTasks } from "@/lib/tasks";
import { Board } from "@/components/Board";
import { InboxView } from "@/components/InboxView";
import { Delta, SampleBadge, money } from "@/components/ui";
import { CommissionTracker } from "@/components/CommissionTracker";
import { businessType, typeLabel } from "@/lib/commission";
import { listJobs } from "@/lib/jobs";
import { syncPaintscout } from "@/lib/integrations/paintscout";
import { getKV } from "@/lib/store";
import { WidgetGrid, type Widget } from "@/components/WidgetGrid";
import { LineChart, Sparkline } from "@/components/charts";
import type { Layouts } from "react-grid-layout";

export const dynamic = "force-dynamic";

/** Shopify-style stat tile: small label, big number, trend line in the corner. */
function Tile({ label, value, sub, trend }: { label: string; value: string; sub?: React.ReactNode; trend?: number[] }) {
  return (
    <div className="flex h-full flex-col justify-center px-4 py-3">
      <div className="text-[13px] font-semibold underline decoration-dotted decoration-[var(--faint)] underline-offset-4">{label}</div>
      <div className="mt-1.5 flex items-end justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[20px] font-semibold leading-none tabular-nums">{value}</div>
          {sub && <div className="mt-1.5 truncate text-[12px] text-muted">{sub}</div>}
        </div>
        {trend && <Sparkline values={trend} />}
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: React.ReactNode; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-[13px] odd:bg-sidebar/60 ${strong ? "font-semibold" : ""}`}>
      <span className={strong ? "" : "text-muted"}>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

const TABS = ["analytics", "tasks", "inbox"] as const;
type Tab = (typeof TABS)[number];

export default async function BusinessPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { id } = await params;
  const q = await searchParams;
  const tab: Tab = (TABS as readonly string[]).includes(q.tab ?? "") ? (q.tab as Tab) : "analytics";
  const b = await getBusiness(id);
  if (!b) notFound();
  const type = businessType(b);
  const commission = type === "commission";
  // Only load what the open tab shows.
  const [m, all, tasks] = await Promise.all([getMetrics(id), getBusinesses(), listTasks({ businessId: id })]);
  if (!m) notFound();
  const openCount = tasks.filter((t) => t.status !== "done").length;

  const header = (
    <div className="px-6 pt-6 lg:px-8">
      <header className="flex items-center gap-3">
        <BizMark business={b} size={40} />
        <div className="min-w-0">
          <h1 className="text-[22px] font-semibold leading-tight tracking-tight">{b.name}</h1>
          <div className="mt-0.5 flex items-center gap-2 text-[12px] text-muted">
            <span className="rounded-md bg-sidebar px-1.5 py-0.5 text-ink">{typeLabel(type)}</span>
            {!commission && <SampleBadge live={m.live} />}
            {b.tagline && <span className="truncate">{b.tagline}</span>}
          </div>
        </div>
        <Link href="/businesses" className="btn btn-ghost ml-auto border border-line">Edit</Link>
      </header>
      <nav className="mt-4 flex gap-1 border-b border-line" aria-label={`${b.name} sections`}>
        {TABS.map((t) => (
          <Link
            key={t}
            href={t === "analytics" ? `/business/${id}` : `/business/${id}?tab=${t}`}
            aria-current={tab === t ? "page" : undefined}
            className={`-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-[14px] ${tab === t ? "border-accent font-medium text-ink" : "border-transparent text-muted hover:text-ink"}`}
          >
            {t === "analytics" ? (commission ? "Jobs & commission" : "Analytics") : t === "tasks" ? "Tasks" : "Inbox"}
            {t === "tasks" && openCount > 0 && <span className="text-[12px] text-faint tabular-nums">{openCount}</span>}
          </Link>
        ))}
      </nav>
    </div>
  );

  if (tab === "tasks")
    return (
      <div className="pb-10">
        {header}
        <div className="pt-5"><Board initialTasks={tasks} businesses={all} fixedBusiness={id} /></div>
      </div>
    );
  if (tab === "inbox")
    return (
      <div className="pb-10">
        {header}
        <div className="pt-5"><InboxView emails={await getEmails(id)} businesses={all} fixedBusiness={id} /></div>
      </div>
    );
  if (commission) {
    const psStatus = await syncPaintscout(id);
    const jobs = await listJobs(id);
    return (
      <div className="pb-10">
        {header}
        <div className="px-6 pt-5 lg:px-8"><CommissionTracker business={b} initial={jobs} paintscout={psStatus} /></div>
      </div>
    );
  }
  const saved = await getKV<Layouts>(`pref:layout:biz:${id}`);

  const none = "–";
  const trend = m.daily.map((d) => d.revenue);
  const revTile = <Tile label="Revenue · 30 days" value={money(m.revenue30d)} sub={<><Delta now={m.revenue30d} prev={m.revenuePrev30d} /> vs previous 30 days</>} trend={trend} />;
  const tiles: [string, React.ReactNode][] =
    type === "app"
      ? [
          ["mrr", <Tile key="a" label="MRR" value={m.mrr ? money(m.mrr) : none} sub="Monthly recurring revenue" />],
          ["subs", <Tile key="b" label="Paying subscribers" value={m.subscribers ? m.subscribers.toLocaleString() : none} />],
          ["arpu", <Tile key="c" label="Revenue per subscriber" value={m.subscribers ? `$${(m.mrr / m.subscribers).toFixed(2)}` : none} sub="per month" />],
          ["rev", revTile],
        ]
      : type === "saas"
        ? [
            ["mrr", <Tile key="a" label="MRR" value={m.mrr ? money(m.mrr) : none} sub="Monthly recurring revenue" />],
            ["arr", <Tile key="b" label="ARR" value={m.mrr ? money(m.mrr * 12) : none} sub="MRR × 12" />],
            ["subs", <Tile key="c" label="Paying customers" value={m.subscribers ? m.subscribers.toLocaleString() : none} />],
            ["rev", revTile],
          ]
        : [
            ["rev", revTile],
            ["orders", <Tile key="a" label="Orders · 30 days" value={m.orders30d.toLocaleString()} />],
            ["aov", <Tile key="b" label="Average order" value={m.orders30d ? `$${(m.revenue30d / m.orders30d).toFixed(2)}` : none} />],
            ["cash", <Tile key="c" label="Cash" value={money(m.cash)} />],
          ];

  const widgets: Widget[] = [
        ...tiles.map(([key, node], i): Widget => ({ id: `kpi-${key}`, bare: true, at: { x: i * 3, y: 0, w: 3, h: 2, minW: 2, minH: 2 }, smH: 2, children: node })),
        {
          id: "chart",
          title: type === "ecommerce" ? "Total sales over time" : "Revenue over time",
          extra: <span className="text-[12px] text-faint">Last 30 days</span>,
          at: { x: 0, y: 2, w: 8, h: 7, minW: 3, minH: 4 },
          smH: 6,
          children: <LineChart points={m.daily.map((d) => ({ date: d.date, value: d.revenue }))} color={b.color} />,
        },
        {
          id: "breakdown",
          title: type === "ecommerce" ? "Sales breakdown" : "Revenue breakdown",
          at: { x: 8, y: 2, w: 4, h: 7, minW: 2, minH: 3 },
          smH: 6,
          children: (
            <div>
              {m.streams.map((s) => (
                <Row
                  key={s.source + s.account}
                  label={`${s.source[0].toUpperCase()}${s.source.slice(1)}${m.streams.filter((x) => x.source === s.source).length > 1 ? ` · ${s.account.toLowerCase()}` : ""}`}
                  value={s.live ? money(s.revenue30d) : <span className="text-faint">Not connected</span>}
                />
              ))}
              {type !== "ecommerce" && <Row label="MRR" value={m.mrr ? money(m.mrr) : none} />}
              <Row label="Orders" value={m.orders30d.toLocaleString()} />
              <Row label="Previous 30 days" value={money(m.revenuePrev30d)} />
              <Row label="Total · 30 days" value={money(m.revenue30d)} strong />
            </div>
          ),
        },
        ...(type === "app"
          ? [
              {
                id: "appstore",
                title: "Downloads, ratings and daily active users",
                at: { x: 0, y: 9, w: 12, h: 2, minW: 3, minH: 2 },
                smH: 3,
                children: (
                  <p className="text-[13px] text-muted">
                    These come from App Store Connect and Google Play, which aren&apos;t connected yet. Subscription numbers come from Stripe.
                  </p>
                ),
              } satisfies Widget,
            ]
          : []),
      ];

  return (
    <div className="pb-10">
      {header}
      <div className="px-6 pt-3 lg:px-8">
        {b.description && <p className="mb-1 max-w-3xl text-[13px] leading-relaxed text-muted line-clamp-2">{b.description}</p>}
        <WidgetGrid widgets={widgets} prefKey={`layout:biz:${id}`} saved={saved} />
      </div>
    </div>
  );
}
