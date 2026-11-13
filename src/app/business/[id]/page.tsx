import Link from "next/link";
import { notFound } from "next/navigation";
import { BizMark } from "@/components/BizMark";
import { Icon } from "@/components/Icon";
import { getBusiness, getBusinesses } from "@/lib/businesses";
import { getEmails, getMetrics } from "@/lib/data";
import { listTasks } from "@/lib/tasks";
import { Board } from "@/components/Board";
import { InboxView } from "@/components/InboxView";
import { RevenueChart } from "@/components/RevenueChart";
import { Delta, SampleBadge, Stat, money } from "@/components/ui";
import { CommissionTracker } from "@/components/CommissionTracker";
import { businessType, typeLabel } from "@/lib/commission";
import { listJobs } from "@/lib/jobs";

export const dynamic = "force-dynamic";

export default async function BusinessPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await getBusiness(id);
  if (!b) notFound();
  const [m, emails, all] = await Promise.all([getMetrics(id), getEmails(id), getBusinesses()]);
  if (!m) notFound();
  const type = businessType(b);
  const commission = type === "commission";
  const jobs = commission ? await listJobs(id) : [];

  return (
    <div className="pb-10">
      <header className="px-8 pt-8 pb-6">
        <div className="flex items-center gap-4">
          <BizMark business={b} size={56} />
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[13px] text-muted">
              <span className="rounded-md bg-sidebar px-1.5 py-0.5 text-[12px] text-ink">{typeLabel(type)}</span>
              {b.tagline}
              {!commission && <SampleBadge live={m.live} />}
            </div>
            <h1 className="font-serif text-[34px] leading-tight tracking-tight">{b.name}</h1>
          </div>
          <Link href="/businesses" className="btn btn-ghost border border-line ml-auto">Edit</Link>
        </div>
        {b.description && <p className="mt-4 max-w-3xl text-[15px] leading-relaxed text-muted whitespace-pre-line">{b.description}</p>}
      </header>
      {commission ? (
        <div className="px-8">
          <CommissionTracker business={b} initial={jobs} />
        </div>
      ) : (
      <div className="space-y-6 px-8">
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {(() => {
            const rev = <Stat label="Revenue · 30 days" value={money(m.revenue30d)} sub={<><Delta now={m.revenue30d} prev={m.revenuePrev30d} /> vs previous 30 days</>} />;
            const none = "–";
            if (type === "app")
              return (
                <>
                  <Stat label="MRR" value={m.mrr ? money(m.mrr) : none} sub="Monthly recurring revenue" />
                  <Stat label="Paying subscribers" value={m.subscribers ? m.subscribers.toLocaleString() : none} />
                  <Stat label="Revenue per subscriber" value={m.subscribers ? `$${(m.mrr / m.subscribers).toFixed(2)}` : none} sub="per month" />
                  {rev}
                </>
              );
            if (type === "saas")
              return (
                <>
                  <Stat label="MRR" value={m.mrr ? money(m.mrr) : none} sub="Monthly recurring revenue" />
                  <Stat label="ARR" value={m.mrr ? money(m.mrr * 12) : none} sub="MRR × 12" />
                  <Stat label="Paying customers" value={m.subscribers ? m.subscribers.toLocaleString() : none} />
                  {rev}
                </>
              );
            return (
              <>
                {rev}
                <Stat label="Orders · 30 days" value={m.orders30d.toLocaleString()} />
                <Stat label="Average order" value={m.orders30d ? `$${(m.revenue30d / m.orders30d).toFixed(2)}` : none} />
                <Stat label="Cash" value={money(m.cash)} />
              </>
            );
          })()}
        </div>
        <section className="card p-5">
          <h2 className="mb-1 font-serif text-[20px]">{type === "ecommerce" ? "Daily sales" : "Daily revenue"}</h2>
          <RevenueChart metrics={[m]} businesses={[b]} height={180} />
          <div className="mt-4 flex flex-wrap gap-3 text-[13px] text-muted">
            {m.streams.map((s) => (
              <span key={s.source + s.account} className="rounded-lg border border-line px-2.5 py-1 capitalize">
                {s.source} · {money(s.revenue30d)} {s.live ? "" : "(sample)"}
              </span>
            ))}
          </div>
        </section>
        {type === "app" && (
          <section className="card flex items-start gap-3 p-5 text-[14px]">
            <span className="mt-0.5 text-faint"><Icon name="chart" size={18} /></span>
            <div>
              <div className="font-medium">Downloads, ratings and daily active users</div>
              <p className="mt-0.5 text-muted">These come from App Store Connect and Google Play, which aren&apos;t connected yet. Subscription numbers above come from Stripe.</p>
            </div>
          </section>
        )}
      </div>
      )}
      <h2 className="px-8 pt-8 pb-4 font-serif text-[24px]">Tasks</h2>
      <Board initialTasks={await listTasks({ businessId: id })} businesses={all} fixedBusiness={id} />
      <h2 className="px-8 pt-4 pb-4 font-serif text-[24px]">Inbox</h2>
      <InboxView emails={emails} businesses={all} fixedBusiness={id} />
    </div>
  );
}
