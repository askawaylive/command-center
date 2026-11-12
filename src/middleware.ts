import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, authEnabled, safeEqual, sessionToken } from "@/lib/session";

export async function middleware(req: NextRequest) {
  if (!authEnabled()) return NextResponse.next(); // local mode: no login
  const cookie = req.cookies.get(SESSION_COOKIE)?.value ?? "";
  if (cookie && safeEqual(cookie, await sessionToken())) return NextResponse.next();
  if (req.nextUrl.pathname.startsWith("/api/")) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/|favicon.ico|login|api/login|api/health).*)"],
};
