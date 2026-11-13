import { MindMapStudio } from "@/components/MindMap";
import { listMaps } from "@/lib/mindmaps";

export const dynamic = "force-dynamic";

export default async function MindMapPage() {
  return <MindMapStudio initial={await listMaps()} />;
}
