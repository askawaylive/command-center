import { getAttachment } from "@/lib/mail";
import { mailBusiness, mailError } from "../_shared";

export async function GET(req: Request) {
  const u = new URL(req.url);
  try {
    const b = await mailBusiness(u.searchParams.get("business"));
    const data = await getAttachment(b, u.searchParams.get("message") ?? "", u.searchParams.get("id") ?? "");
    const name = (u.searchParams.get("name") ?? "attachment").replace(/["\r\n]/g, "");
    return new Response(new Uint8Array(data), {
      headers: {
        // Always download, never render inline: attachments are untrusted content.
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${name.replace(/[^\x20-\x7e]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(name)}`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    return mailError(e);
  }
}
