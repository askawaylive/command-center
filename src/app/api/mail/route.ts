import { NextResponse } from "next/server";
import { FOLDERS, isFolder, listThreads, mailAccounts, type ThreadSummary } from "@/lib/mail";
import { mailError } from "./_shared";

/** Conversations in a folder, for one inbox or merged across all connected inboxes. */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const folder = u.searchParams.get("folder") ?? "inbox";
  const which = u.searchParams.get("business") ?? "all";
  const q = (u.searchParams.get("q") ?? "").slice(0, 500);
  let pages: Record<string, string> = {};
  try {
    pages = JSON.parse(u.searchParams.get("page") || "{}");
  } catch {}
  if (!isFolder(folder)) return NextResponse.json({ error: "Unknown folder" }, { status: 400 });
  try {
    const accounts = (await mailAccounts()).filter((b) => which === "all" || b.id === which);
    const more = u.searchParams.has("page");
    const results = await Promise.all(
      accounts
        .filter((b) => !more || pages[b.id])
        .map(async (b) => {
          try {
            const r = await listThreads(b, folder, q, pages[b.id]);
            return { b, ...r, error: undefined as string | undefined };
          } catch (e) {
            return { b, threads: [] as ThreadSummary[], nextPageToken: undefined, error: e instanceof Error ? e.message : String(e) };
          }
        }),
    );
    const threads = results.flatMap((r) => r.threads).sort((a, b) => b.date.localeCompare(a.date));
    const next: Record<string, string> = {};
    for (const r of results) if (r.nextPageToken) next[r.b.id] = r.nextPageToken;
    const errors = results.filter((r) => r.error).map((r) => ({ businessId: r.b.id, error: r.error! }));
    return NextResponse.json({ folder: FOLDERS[folder].name, threads, next: Object.keys(next).length ? next : null, errors });
  } catch (e) {
    return mailError(e);
  }
}
