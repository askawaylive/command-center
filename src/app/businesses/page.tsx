import { BusinessManager } from "@/components/BusinessManager";
import { PageHeader } from "@/components/ui";
import { getBusinesses } from "@/lib/businesses";

export const dynamic = "force-dynamic";

export default async function BusinessesPage() {
  return (
    <div>
      <PageHeader title="Businesses" subtitle="Add, rename, and describe your companies. Claude uses these descriptions as context." />
      <BusinessManager initial={await getBusinesses()} />
    </div>
  );
}
