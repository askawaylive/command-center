import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { publicOrigin } from "@/lib/origin";
import { getBusinesses } from "@/lib/businesses";

export async function GET(req: Request) {
  const account = new URL(req.url).searchParams.get("account") ?? "";
  if (!getBusinesses().some((b) => b.sources.gmail?.account === account)) {
    return NextResponse.json({ error: "Unknown Gmail account key" }, { status: 400 });
  }
  if (!process.env.GOOGLE_CLIENT_ID) return NextResponse.json({ error: "GOOGLE_CLIENT_ID is not set" }, { status: 400 });
  const nonce = randomBytes(16).toString("hex");
  const url =
    "https://accounts.google.com/o/oauth2/v2/auth?" +
    new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      redirect_uri: `${publicOrigin(req)}/api/gmail/callback`,
      response_type: "code",
      scope: "https://www.googleapis.com/auth/gmail.readonly",
      access_type: "offline",
      prompt: "consent select_account",
      state: `${account}.${nonce}`,
    });
  const res = NextResponse.redirect(url);
  res.cookies.set("gmail_oauth", nonce, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/" });
  return res;
}
