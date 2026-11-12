import type { Business, Email } from "../types";
import { getKV } from "../store";

/** Refresh token from .env (local script) or from the in-app "Connect Gmail" flow (stored in the database). */
export async function gmailRefreshToken(account: string): Promise<string | undefined> {
  return process.env[`GMAIL_${account}_REFRESH_TOKEN`] || (await getKV<string>(`gmail:${account}`)) || undefined;
}

async function accessToken(refreshToken: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Google token: ${res.status} ${await res.text()}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

interface GmailMessage {
  id: string;
  snippet: string;
  labelIds?: string[];
  internalDate: string;
  payload: { headers: { name: string; value: string }[] };
}

/** Latest inbox messages for a business's Gmail account. */
export async function fetchGmail(b: Business, max = 15): Promise<Email[]> {
  const cfg = b.sources.gmail;
  const refresh = cfg && (await gmailRefreshToken(cfg.account));
  if (!cfg || !refresh) throw new Error(`No Gmail token for ${b.name}`);
  const token = await accessToken(refresh);
  const auth = { Authorization: `Bearer ${token}` };
  const q = ["in:inbox", cfg.query].filter(Boolean).join(" ");
  const list = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${max}&q=${encodeURIComponent(q)}`,
    { headers: auth },
  );
  if (!list.ok) throw new Error(`Gmail list: ${list.status}`);
  const { messages = [] } = (await list.json()) as { messages?: { id: string }[] };

  const full = await Promise.all(
    messages.map(async ({ id }) => {
      const r = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`,
        { headers: auth },
      );
      return (await r.json()) as GmailMessage;
    }),
  );
  return full.map((m) => {
    const h = (n: string) => m.payload.headers.find((x) => x.name.toLowerCase() === n)?.value ?? "";
    return {
      id: m.id,
      businessId: b.id,
      from: h("from").replace(/<.*>/, "").replace(/"/g, "").trim() || h("from"),
      subject: h("subject") || "(no subject)",
      snippet: m.snippet,
      date: new Date(Number(m.internalDate)).toISOString(),
      unread: m.labelIds?.includes("UNREAD") ?? false,
      live: true,
    };
  });
}
