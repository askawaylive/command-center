import { MailClient } from "@/components/mail/MailClient";
import { getBusinesses } from "@/lib/businesses";

export const dynamic = "force-dynamic";

export default async function InboxPage() {
  return (
    <div className="flex h-full flex-col">
      <header className="flex shrink-0 items-end justify-between gap-3 px-4 pt-4 pb-3 md:px-8 md:pt-6 md:pb-4">
        <h1 className="font-serif text-[32px] leading-tight tracking-tight">Inbox</h1>
      </header>
      <div className="min-h-0 flex-1 border-t border-line">
        <MailClient businesses={await getBusinesses()} />
      </div>
    </div>
  );
}
