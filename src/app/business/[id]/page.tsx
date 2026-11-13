import Link from "next/link";
import { notFound } from "next/navigation";
import { BizMark } from "@/components/BizMark";
import { getBusiness, getBusinesses } from "@/lib/businesses";
import { getEmails, getMetrics } from "@/lib/data";
import { listTasks } from "@/lib/tasks";
import { Board } from "@/components/Board";
import { InboxView } from "@/components/InboxView";
import { RevenueChart } from "@/components/RevenueChart";
import { Delta, SampleBadge, Stat, money } from "@/components/ui";
import { CommissionTracker } from "@/components/CommissionTracker";
import { isCommission } from "@/lib/commission";
import { listJobs } from "@/lib/jobs";

export const dynamic = "force-dynamic";

export default async function BusinessPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await getBusiness(id);
  if (!b) notFound();
  const [m, emails, all] = await Promise.all([getMetrics(id), getEmails(id), getBusinesses()]);
  if (!m) notFound();
  const commission = isCommission(b);
  const jobs = commission ? await listJobs(id) : [];

  return (
    <div className="pb-10">
      <header className="px-8 pt-8 pb-6">
        <div className="flex items-center gap-4">
          <BizMark business={b} size={56} />
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[13px] text-muted">
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
          <Stat label="Revenue · 30 days" value={money(m.revenue30d)} sub={<><Delta now={m.revenue30d} prev={m.revenuePrev30d} /> vs previous 30 days</>} />
          <Stat label="MRR" value={m.mrr ? money(m.mrr) : "–"} />
          <Stat label="Cash" value={money(m.cash)} />
          <Stat label="Orders · 30 days" value={m.orders30d.toLocaleString()} />
        </div>
        <section className="card p-5">
          <h2 className="mb-1 font-serif text-[20px]">Daily revenue</h2>
          <RevenueChart metrics={[m]} businesses={[b]} height={180} />
          <div className="mt-4 flex flex-wrap gap-3 text-[13px] text-muted">
            {m.streams.map((s) => (
              <span key={s.source + s.account} className="rounded-lg border border-line px-2.5 py-1 capitalize">
                {s.source} · {money(s.revenue30d)} {s.live ? "" : "(sample)"}
              </span>
            ))}
          </div>
        </section>
      </div>
      )}
      <h2 className="px-8 pt-8 pb-4 font-serif text-[24px]">Tasks</h2>
      <Board initialTasks={await listTasks({ businessId: id })} businesses={all} fixedBusiness={id} />
      <h2 className="px-8 pt-4 pb-4 font-serif text-[24px]">Inbox</h2>
      <InboxView emails={emails} businesses={all} fixedBusiness={id} />
    </div>
  );
}
