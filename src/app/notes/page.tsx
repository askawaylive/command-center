import { NotesArchive } from "@/components/NotesArchive";
import { getBusinesses } from "@/lib/businesses";
import { listNotes } from "@/lib/notes";

export const dynamic = "force-dynamic";

export default async function NotesPage() {
  const [businesses, notes] = await Promise.all([getBusinesses(), listNotes()]);
  return <NotesArchive initial={notes} businesses={businesses} />;
}
