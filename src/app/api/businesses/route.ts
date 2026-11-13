import { NextResponse } from "next/server";
import { BUSINESS_COLORS, getBusinesses, saveBusinesses } from "@/lib/businesses";
import { clearCache } from "@/lib/cache";
import type { Business } from "@/lib/types";

export async function GET() {
  return NextResponse.json(await getBusinesses());
}

const KEY_RE = /^[A-Z0-9]{1,32}$/;
const LOGO_RE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;

function clean(b: Business, i: number): Business {
  const keys = (xs?: string[]) => (xs ?? []).map((x) => x.trim().toUpperCase()).filter((x) => KEY_RE.test(x));
  const gmailKey = b.sources?.gmail?.account?.trim().toUpperCase();
  return {
    id: String(b.id).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 32),
    name: String(b.name ?? "").trim().slice(0, 60) || "Untitled",
    tagline: String(b.tagline ?? "").trim().slice(0, 80),
    description: String(b.description ?? "").trim().slice(0, 2000) || undefined,
    logo: typeof b.logo === "string" && LOGO_RE.test(b.logo) && b.logo.length < 200_000 ? b.logo : undefined,
    color: /^#[0-9a-fA-F]{6}$/.test(b.color) ? b.color : BUSINESS_COLORS[i % BUSINESS_COLORS.length],
    type: (["app", "ecommerce", "saas", "commission"] as const).includes(b.type as never) ? b.type : undefined,
    commission:
      b.commission && Number.isFinite(b.commission.rate) && Number.isFinite(b.commission.costPct)
        ? { rate: Math.min(100, Math.max(0, b.commission.rate)), costPct: Math.min(100, Math.max(0, b.commission.costPct)) }
        : undefined,
    sources: {
      stripe: keys(b.sources?.stripe),
      shopify: keys(b.sources?.shopify),
      mercuryAccountIds: (b.sources?.mercuryAccountIds ?? []).map((x) => x.trim()).filter(Boolean),
      ...(gmailKey && KEY_RE.test(gmailKey) ? { gmail: { account: gmailKey, query: b.sources.gmail?.query?.trim() || undefined } } : {}),
    },
  };
}

export async function PUT(req: Request) {
  const body = (await req.json()) as Business[];
  if (!Array.isArray(body) || body.length === 0) return NextResponse.json({ error: "Keep at least one business" }, { status: 400 });
  const list = body.map(clean).filter((b) => b.id);
  const ids = new Set(list.map((b) => b.id));
  if (ids.size !== list.length) return NextResponse.json({ error: "Two businesses have the same name" }, { status: 400 });
  await saveBusinesses(list);
  clearCache();
  return NextResponse.json(list);
}
