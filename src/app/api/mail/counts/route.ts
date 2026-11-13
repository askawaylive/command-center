import { NextResponse } from "next/server";
import { canManage, folderCounts, mailAccounts, profileEmail } from "@/lib/mail";

export async function GET() {
  const accounts = await mailAccounts();
  const counts = await Promise.all(
    accounts.map(async (b) => ({
      businessId: b.id,
      manage: await canManage(b.sources.gmail!.account),
      email: await profileEmail(b).catch(() => ""),
      ...(await folderCounts(b).catch(() => ({ inbox: 0, spam: 0, drafts: 0 }))),
    })),
  );
  return NextResponse.json({ accounts: counts });
}
