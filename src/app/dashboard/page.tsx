import Link from "next/link";
import { getBusinesses } from "@/lib/businesses";
import { getAllMetrics, getBankAccounts } from "@/lib/data";
import { RevenueChart } from "@/components/RevenueChart";
import { Delta, PageHeader, SampleBadge, Stat, money } from "@/components/ui";
import { RefreshButton } from "@/components/RefreshButton";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const businesses = await getBusinesses();
  const [metrics, accounts] = await Promise.all([getAllMetrics(), getBankAccounts()]);
  const sum = (f: (m: (typeof metrics)[number]) => number) => metrics.reduce((s, m) => s + f(m), 0);
  const revenue = sum((m) => m.revenue30d);
  const prev = sum((m) => m.revenuePrev30d);
  const cash = accounts.reduce((s, a) => s + a.balance, 0);
  const anyLive = metrics.some((m) => m.live);

  return (
    <div className="pb-10">
      <PageHeader title="Metrics" subtitle="Last 30 days across every business.">
        <div className="flex items-center gap-2">
          <SampleBadge live={anyLive} />
          <RefreshButton />
        </div>
      </PageHeader>
      <div className="px-8 space-y-6">
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <Stat label="Revenue · 30 days" value={money(revenue)} sub={<><Delta now={revenue} prev={prev} /> vs previous 30 days</>} />
          <Stat label="Recurring (MRR)" value={money(sum((m) => m.mrr))} sub="From active Stripe subscriptions" />
          <Stat label="Cash in Mercury" value={money(cash)} sub={`${accounts.length} accounts`} />
          <Stat label="Orders · 30 days" value={sum((m) => m.orders30d).toLocaleString()} sub="Stripe charges + Shopify orders" />
        </div>

        <section className="card p-5">
          <h2 className="font-serif text-[20px] mb-1">Daily revenue</h2>
          <RevenueChart metrics={metrics} businesses={businesses} />
        </section>

        <section className="card overflow-hidden">
          <h2 className="font-serif text-[20px] px-5 pt-5 pb-3">By business</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-[14px]">
              <thead className="text-[12px] text-muted">
                <tr className="border-y border-line">
                  {["Business", "Revenue 30d", "Change", "Orders", "MRR", "Cash", "Sources"].map((h) => (
                    <th key={h} className="px-5 py-2 text-left font-normal">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {metrics.map((m) => {
                  const b = businesses.find((x) => x.id === m.businessId)!;
                  return (
                    <tr key={m.businessId} className="border-b border-line last:border-0 hover:bg-bg">
                      <td className="px-5 py-3">
                        <Link href={`/business/${b.id}`} className="inline-flex items-center gap-2 hover:text-accent">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ background: b.color }} /> {b.name}
                        </Link>
                      </td>
                      <td className="px-5 py-3 tabular-nums">{money(m.revenue30d)}</td>
                      <td className="px-5 py-3"><Delta now={m.revenue30d} prev={m.revenuePrev30d} /></td>
                      <td className="px-5 py-3 tabular-nums">{m.orders30d.toLocaleString()}</td>
                      <td className="px-5 py-3 tabular-nums">{m.mrr ? money(m.mrr) : "–"}</td>
                      <td className="px-5 py-3 tabular-nums">{money(m.cash)}</td>
                      <td className="px-5 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          {m.streams.map((s) => (
                            <span key={s.source + s.account} className="rounded-md border border-line px-1.5 py-0.5 text-[11px] text-muted capitalize">
                              {s.source}{s.live ? "" : " · sample"}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card p-5">
          <h2 className="font-serif text-[20px] mb-3">Mercury accounts</h2>
          <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {accounts.map((a) => (
              <div key={a.id} className="rounded-xl border border-line p-3">
                <div className="flex items-center justify-between text-[12px] text-muted">
                  <span className="truncate">{a.name}</span>
                  <SampleBadge live={a.live} />
                </div>
                <div className="mt-1 font-serif text-[22px] tabular-nums">{money(a.balance)}</div>
                <div className="text-[12px] text-faint">{businesses.find((b) => b.id === a.businessId)?.name ?? "Unassigned"}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
