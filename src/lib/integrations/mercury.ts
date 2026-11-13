import type { BankAccount, Business } from "../types";
import { mockCash } from "../mock";

interface MercuryAccount {
  id: string;
  name: string;
  nickname?: string | null;
  currentBalance: number;
  availableBalance: number;
  status: string;
}

export function hasMercury() {
  return Boolean(process.env.MERCURY_API_TOKEN);
}

/** All Mercury accounts, tagged with the business that owns them (via mercuryAccountIds in businesses.json). */
export async function fetchMercuryAccounts(businesses: Business[]): Promise<BankAccount[]> {
  const token = process.env.MERCURY_API_TOKEN;
  if (!token) return mockBankAccounts(businesses);
  const res = await fetch("https://api.mercury.com/api/v1/accounts", {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Mercury: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { accounts: MercuryAccount[] };
  return json.accounts
    .filter((a) => a.status !== "archived")
    .map((a) => ({
      id: a.id,
      name: a.nickname || a.name,
      balance: a.currentBalance,
      businessId: businesses.find((b) => b.sources.mercuryAccountIds?.includes(a.id))?.id,
      live: true,
    }));
}

export function mockBankAccounts(businesses: Business[]): BankAccount[] {
  return businesses.filter((b) => (b.sources.stripe?.length ?? 0) + (b.sources.shopify?.length ?? 0) > 0).map((b) => ({
    id: `mock-${b.id}`,
    name: `${b.name} Checking`,
    balance: mockCash(b.id),
    businessId: b.id,
    live: false,
  }));
}
