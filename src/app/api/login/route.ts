import { NextResponse } from "next/server";
import { SESSION_COOKIE, safeEqual, sessionToken } from "@/lib/session";

export async function POST(req: Request) {
  const { password } = (await req.json()) as { password?: string };
  const expected = process.env.APP_PASSWORD ?? "";
  if (!expected || !password || !safeEqual(password, expected)) {
    await new Promise((r) => setTimeout(r, 800)); // slow down guessing
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await sessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
