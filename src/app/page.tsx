import { Planner } from "@/components/Planner";
import { getBusinesses } from "@/lib/businesses";
import { listTasks } from "@/lib/tasks";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const [businesses, tasks] = await Promise.all([getBusinesses(), listTasks()]);
  return <Planner initialTasks={tasks} businesses={businesses} name={process.env.OWNER_NAME || "Scott"} />;
}
