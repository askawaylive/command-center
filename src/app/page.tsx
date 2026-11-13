import { Planner } from "@/components/Planner";
import { getBusinesses } from "@/lib/businesses";
import { getEmails } from "@/lib/data";
import { listTasks } from "@/lib/tasks";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const [businesses, emails] = await Promise.all([getBusinesses(), getEmails()]);
  return <Planner initialTasks={await listTasks()} businesses={businesses} emails={emails} name={process.env.OWNER_NAME || "Scott"} />;
}
