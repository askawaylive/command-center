import { Planner } from "@/components/Planner";
import { getBusinesses } from "@/lib/businesses";
import { getEmails } from "@/lib/data";
import { listTasks } from "@/lib/tasks";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const [businesses, emails] = [getBusinesses(), await getEmails()];
  return <Planner initialTasks={listTasks()} businesses={businesses} emails={emails} name={process.env.OWNER_NAME || "Scott"} />;
}
