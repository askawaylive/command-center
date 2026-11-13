import type { Business, Email } from "../types";
import { getKV } from "../store";

/** Refresh token from .env (local script) or from the in-app "Connect Gmail" flow (stored in the database). */
export async function gmailRefreshToken(account: string): Promise<string | undefined> {
  return process.env[`GMAIL_${account}_REFRESH_TOKEN`] || (await getKV<string>(`gmail:${account}`)) || undefined;
}

export async function gmailCanSend(account: string): Promise<boolean> {
  return ((await getKV<string>(`gmailscope:${account}`)) ?? "").includes("gmail.send");
}

export async function accessToken(refreshToken: string) {
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
  threadId: string;
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
  const canReply = await gmailCanSend(cfg.account);
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
      threadId: m.threadId,
      canReply,
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

const header = (m: GmailMessage, n: string) => m.payload.headers.find((x) => x.name.toLowerCase() === n.toLowerCase())?.value ?? "";
const b64url = (s: string) => Buffer.from(s, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
/** RFC 2047 encode a header value only when it has non-ASCII characters. */
const encWord = (s: string) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${Buffer.from(s, "utf8").toString("base64")}?=`);

export class GmailReconnectError extends Error {}

/** Reply to a message in its thread, from the business's own inbox. Headers come from Gmail, never from the browser. */
export async function replyGmail(b: Business, messageId: string, body: string) {
  const cfg = b.sources.gmail;
  const refresh = cfg && (await gmailRefreshToken(cfg.account));
  if (!cfg || !refresh) throw new Error(`${b.name} has no connected inbox`);
  if (!(await gmailCanSend(cfg.account))) throw new GmailReconnectError("Reconnect this inbox to allow replies");
  const auth = { Authorization: `Bearer ${await accessToken(refresh)}` };
  const r = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}?format=metadata` +
      ["From", "Reply-To", "Subject", "Message-ID", "References"].map((h) => `&metadataHeaders=${h}`).join(""),
    { headers: auth },
  );
  if (!r.ok) throw new Error(`Gmail: couldn't load the original email (${r.status})`);
  const m = (await r.json()) as GmailMessage;
  const to = header(m, "Reply-To") || header(m, "From");
  const subject = header(m, "Subject");
  const msgId = header(m, "Message-ID");
  const refs = [header(m, "References"), msgId].filter(Boolean).join(" ");
  const lines = [
    `To: ${to}`,
    `Subject: ${encWord(/^re:/i.test(subject) ? subject : `Re: ${subject}`)}`,
    ...(msgId ? [`In-Reply-To: ${msgId}`, `References: ${refs}`] : []),
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    body.replace(/\r?\n/g, "\r\n"),
  ];
  const send = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({ raw: b64url(lines.join("\r\n")), threadId: m.threadId }),
  });
  if (send.status === 403) throw new GmailReconnectError("Google didn't allow sending. Reconnect this inbox.");
  if (!send.ok) throw new Error(`Gmail send: ${send.status} ${await send.text()}`);
  return { to };
}
