import { Board } from "@/components/Board";
import { PageHeader } from "@/components/ui";
import { getBusinesses } from "@/lib/businesses";
import { listTasks } from "@/lib/tasks";

export const dynamic = "force-dynamic";

export default function BoardPage() {
  return (
    <div>
      <PageHeader title="Launch board" subtitle="Everything in flight, by stage. Drag cards between columns." />
      <Board initialTasks={listTasks()} businesses={getBusinesses()} />
    </div>
  );
}
