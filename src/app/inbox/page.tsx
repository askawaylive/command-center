import { InboxView } from "@/components/InboxView";
import { PageHeader } from "@/components/ui";
import { RefreshButton } from "@/components/RefreshButton";
import { getBusinesses } from "@/lib/businesses";
import { getEmails } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function InboxPage() {
  return (
    <div>
      <PageHeader title="Inbox" subtitle="Every business's Gmail in one place. Turn any email into a task.">
        <RefreshButton />
      </PageHeader>
      <InboxView emails={await getEmails()} businesses={getBusinesses()} />
    </div>
  );
}
