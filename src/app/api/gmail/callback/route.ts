import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { publicOrigin } from "@/lib/origin";
import { setKV } from "@/lib/store";
import { clearCache } from "@/lib/cache";

export async function GET(req: Request) {
  const u = new URL(req.url);
  const [account, nonce] = (u.searchParams.get("state") ?? "").split(".");
  const expected = (await cookies()).get("gmail_oauth")?.value;
  const origin = publicOrigin(req);
  if (!nonce || nonce !== expected) return NextResponse.redirect(`${origin}/settings?gmail=error`);

  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: u.searchParams.get("code") ?? "",
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: `${origin}/api/gmail/callback`,
      grant_type: "authorization_code",
    }),
  });
  const json = (await r.json()) as { refresh_token?: string };
  if (!json.refresh_token) return NextResponse.redirect(`${origin}/settings?gmail=error`);
  await setKV(`gmail:${account}`, json.refresh_token);
  clearCache();
  const res = NextResponse.redirect(`${origin}/settings?gmail=connected`);
  res.cookies.delete("gmail_oauth");
  return res;
}
