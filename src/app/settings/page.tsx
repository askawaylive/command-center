import { getBusinesses } from "@/lib/businesses";
import { getAllMetrics, getEmails, getSourceStatus } from "@/lib/data";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

const HOW: Record<string, string> = {
  claude: "ANTHROPIC_API_KEY from platform.claude.com",
  mercury: "MERCURY_API_TOKEN from Mercury › Settings › API tokens (read only)",
  stripe: "STRIPE_<KEY>_SECRET_KEY, a restricted read-only key per Stripe account",
  shopify: "SHOPIFY_<KEY>_STORE and SHOPIFY_<KEY>_TOKEN from a custom app with read_orders",
  gmail: "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, then use Connect Gmail",
};

export default async function SettingsPage() {
  await Promise.all([getAllMetrics(), getEmails()]); // populate any connection errors
  const status = await getSourceStatus();
  const businesses = await getBusinesses();
  return (
    <div className="pb-10">
      <PageHeader title="Connections" subtitle="Add keys on Render’s Environment page. Anything not connected shows as zero until it is." />
      <div className="px-8">
        <div className="card divide-y divide-[var(--border)]">
          {status.map((s) => (
            <div key={s.name} className="flex items-start gap-4 px-5 py-3.5">
              <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${s.connected && !s.error ? "bg-good" : s.error ? "bg-bad" : "bg-line"}`} />
              <div className="flex-1">
                <div className="text-[14px]">
                  {s.name}
                  {s.businessId && <span className="text-muted"> · {businesses.find((b) => b.id === s.businessId)?.name}</span>}
                </div>
                <div className="text-[12px] text-muted">{s.error ? `Error: ${s.error.slice(0, 200)}` : s.connected ? (s.kind === "gmail" && !s.canSend ? "Connected, read only. Reconnect to reply from the app." : "Connected") : HOW[s.kind]}</div>
              </div>
              {s.kind === "gmail" && process.env.GOOGLE_CLIENT_ID && (
                <a href={`/api/gmail/connect?account=${s.name.split(" · ")[1]}`} className="btn btn-ghost border border-line shrink-0">
                  {s.connected ? "Reconnect" : "Connect Gmail"}
                </a>
              )}
            </div>
          ))}
        </div>
        <p className="mt-4 text-[13px] text-muted">
          To add a business or change which Stripe, Shopify, Mercury, or Gmail accounts belong to it, edit <code className="rounded bg-sidebar px-1">data/businesses.json</code>.
        </p>
      </div>
    </div>
  );
}
