import { Planner } from "@/components/Planner";
import { getBusinesses } from "@/lib/businesses";
import { listPhotos } from "@/lib/photos";
import { getKV } from "@/lib/store";
import { listTasks } from "@/lib/tasks";
import type { Layouts } from "react-grid-layout";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const [businesses, tasks, photos, interval, layouts] = await Promise.all([
    getBusinesses(),
    listTasks(),
    listPhotos(),
    getKV<number>("pref:photos:interval"),
    getKV<Layouts>("pref:layout:today"),
  ]);
  return (
    <Planner
      initialTasks={tasks}
      businesses={businesses}
      name={process.env.OWNER_NAME || "Scott"}
      photos={photos}
      photoInterval={typeof interval === "number" ? interval : 10}
      savedLayouts={layouts}
    />
  );
}
