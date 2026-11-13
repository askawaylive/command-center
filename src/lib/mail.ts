import "server-only";
import type { Business } from "./types";
import { getBusinesses } from "./businesses";
import { gmailRefreshToken, accessToken } from "./integrations/gmail";
import { getKV } from "./store";

/** Full mail client on top of the Gmail API. Every call is scoped to one business's connected inbox. */

export const FOLDERS = {
  inbox: { label: "INBOX", name: "Inbox" },
  starred: { label: "STARRED", name: "Starred" },
  sent: { label: "SENT", name: "Sent" },
  drafts: { label: "DRAFT", name: "Drafts" },
  all: { label: "", name: "All Mail" },
  spam: { label: "SPAM", name: "Spam" },
  trash: { label: "TRASH", name: "Trash" },
} as const;
export type Folder = keyof typeof FOLDERS;
export const isFolder = (f: string): f is Folder => f in FOLDERS;

export class MailError extends Error {
  constructor(msg: string, public status = 502, public reconnect = false) {
    super(msg);
  }
}

const tokens = new Map<string, { token: string; until: number }>();

export async function mailAccounts(): Promise<Business[]> {
  const out: Business[] = [];
  for (const b of await getBusinesses()) if (b.sources.gmail && (await gmailRefreshToken(b.sources.gmail.account))) out.push(b);
  return out;
}

/** True when the inbox was connected with full mailbox permissions (archive, labels, drafts, send). */
export async function canManage(account: string) {
  return ((await getKV<string>(`gmailscope:${account}`)) ?? "").includes("gmail.modify");
}

async function api<T>(b: Business, path: string, init: RequestInit = {}): Promise<T> {
  const acct = b.sources.gmail?.account;
  const refresh = acct && (await gmailRefreshToken(acct));
  if (!acct || !refresh) throw new MailError(`${b.name}'s inbox isn't connected`, 400, true);
  let t = tokens.get(refresh);
  if (!t || t.until < Date.now()) {
    t = { token: await accessToken(refresh), until: Date.now() + 50 * 60_000 };
    tokens.set(refresh, t);
  }
  const r = await fetch(`${process.env.GMAIL_API_BASE || "https://gmail.googleapis.com/gmail/v1"}/users/me/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${t.token}`, ...(init.body ? { "Content-Type": "application/json" } : {}), ...init.headers },
    cache: "no-store",
  });
  if (r.status === 401) tokens.delete(refresh);
  if (r.status === 403) throw new MailError(`Google needs more permission for ${b.name}. Reconnect this inbox on the Connections page.`, 403, true);
  if (!r.ok) throw new MailError(`Gmail ${r.status}: ${(await r.text()).slice(0, 200)}`, r.status >= 500 ? 502 : r.status);
  const text = await r.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

interface Header { name: string; value: string }
interface Part {
  partId?: string;
  mimeType: string;
  filename?: string;
  headers?: Header[];
  body?: { size?: number; data?: string; attachmentId?: string };
  parts?: Part[];
}
interface GMessage {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  internalDate?: string;
  payload?: Part;
}

const hdr = (p: Part | undefined, n: string) => p?.headers?.find((h) => h.name.toLowerCase() === n.toLowerCase())?.value ?? "";
const decode = (d?: string) => (d ? Buffer.from(d.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8") : "");
const b64url = (s: string) => Buffer.from(s, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const encWord = (s: string) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${Buffer.from(s, "utf8").toString("base64")}?=`);
const displayName = (from: string) => from.replace(/<.*>/, "").replace(/"/g, "").trim() || from.replace(/[<>]/g, "");

export interface ThreadSummary {
  id: string;
  businessId: string;
  from: string;
  to: string;
  subject: string;
  snippet: string;
  date: string;
  count: number;
  unread: boolean;
  starred: boolean;
  labels: string[];
  hasAttachment: boolean;
  draftId?: string;
}

export interface Attachment {
  id: string;
  messageId: string;
  name: string;
  size: number;
  mimeType: string;
}
export interface FullMessage {
  id: string;
  from: string;
  fromEmail: string;
  to: string;
  cc: string;
  replyTo: string;
  subject: string;
  date: string;
  html?: string;
  text?: string;
  snippet: string;
  unread: boolean;
  labels: string[];
  messageIdHeader: string;
  references: string;
  attachments: Attachment[];
}

function hasAttachment(p?: Part): boolean {
  if (!p) return false;
  if (p.filename && p.body?.attachmentId) return true;
  return (p.parts ?? []).some(hasAttachment);
}

function summarize(b: Business, msgs: GMessage[], draftId?: string): ThreadSummary {
  const last = msgs[msgs.length - 1];
  const labels = [...new Set(msgs.flatMap((m) => m.labelIds ?? []))];
  // Show who the conversation is with: the last sender who isn't you, else the recipient.
  const incoming = [...msgs].reverse().find((m) => !(m.labelIds ?? []).includes("SENT"));
  const sentOnly = !incoming;
  return {
    id: last.threadId,
    businessId: b.id,
    from: sentOnly ? `To: ${displayName(hdr(last.payload, "To"))}` : displayName(hdr(incoming!.payload, "From")),
    to: hdr(last.payload, "To"),
    subject: hdr(msgs[0].payload, "Subject") || "(no subject)",
    snippet: last.snippet ? decodeEntities(last.snippet) : "",
    date: new Date(Number(last.internalDate ?? 0)).toISOString(),
    count: msgs.length,
    unread: labels.includes("UNREAD"),
    starred: labels.includes("STARRED"),
    labels,
    hasAttachment: msgs.some((m) => hasAttachment(m.payload)),
    draftId,
  };
}

function decodeEntities(s: string) {
  return s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

const META = ["From", "To", "Subject", "Date"].map((h) => `metadataHeaders=${h}`).join("&");

/** One page of conversations in a folder. */
export async function listThreads(b: Business, folder: Folder, q = "", pageToken?: string) {
  if (folder === "drafts") {
    const params = new URLSearchParams({ maxResults: "25" });
    if (q) params.set("q", q);
    if (pageToken) params.set("pageToken", pageToken);
    const r = await api<{ drafts?: { id: string; message: { id: string; threadId: string } }[]; nextPageToken?: string }>(b, `drafts?${params}`);
    const threads = await Promise.all(
      (r.drafts ?? []).map(async (d) => {
        const m = await api<GMessage>(b, `messages/${d.message.id}?format=metadata&${META}`);
        return summarize(b, [m], d.id);
      }),
    );
    return { threads, nextPageToken: r.nextPageToken };
  }
  const params = new URLSearchParams({ maxResults: "25" });
  const label = FOLDERS[folder].label;
  if (label) params.set("labelIds", label);
  // All Mail in Gmail hides spam and trash; the API includes them only when asked.
  if (q) params.set("q", q);
  if (pageToken) params.set("pageToken", pageToken);
  if (folder === "spam" || folder === "trash") params.set("includeSpamTrash", "true");
  const r = await api<{ threads?: { id: string; historyId?: string }[]; nextPageToken?: string }>(b, `threads?${params}`);
  const threads = await Promise.all(
    (r.threads ?? []).map(async (t) => {
      // A thread's historyId changes whenever anything in it changes, so an unchanged
      // conversation is served from memory instead of another call to Gmail.
      const ck = `${b.id}:${t.id}:${t.historyId ?? ""}`;
      const hit = t.historyId ? summaries.get(ck) : undefined;
      if (hit) return hit;
      const full = await api<{ messages: GMessage[] }>(b, `threads/${t.id}?format=metadata&${META}`);
      const s = summarize(b, full.messages);
      if (t.historyId) remember(ck, s);
      return s;
    }),
  );
  return { threads, nextPageToken: r.nextPageToken };
}

const summaries = new Map<string, ThreadSummary>();
function remember(k: string, v: ThreadSummary) {
  summaries.set(k, v);
  if (summaries.size > 3000) summaries.delete(summaries.keys().next().value!);
}

const profiles = new Map<string, string>();
export async function profileEmail(b: Business) {
  const k = b.sources.gmail?.account ?? b.id;
  if (!profiles.has(k)) profiles.set(k, (await api<{ emailAddress: string }>(b, "profile")).emailAddress);
  return profiles.get(k)!;
}

const countCache = new Map<string, { at: number; v: { inbox: number; spam: number; drafts: number } }>();
export function forgetCounts() {
  countCache.clear();
}
export async function folderCounts(b: Business) {
  const hit = countCache.get(b.id);
  if (hit && Date.now() - hit.at < 30_000) return hit.v;
  const get = (id: string) => api<{ threadsUnread?: number; threadsTotal?: number }>(b, `labels/${id}`).catch(() => ({ threadsUnread: 0, threadsTotal: 0 }));
  const [inbox, spam, draft] = await Promise.all([get("INBOX"), get("SPAM"), get("DRAFT")]);
  const v = { inbox: inbox.threadsUnread ?? 0, spam: spam.threadsUnread ?? 0, drafts: draft.threadsTotal ?? 0 };
  countCache.set(b.id, { at: Date.now(), v });
  return v;
}

function walk(p: Part, out: { html?: string; text?: string; attachments: Omit<Attachment, "messageId">[] }) {
  if (p.filename && p.body?.attachmentId) {
    out.attachments.push({ id: p.body.attachmentId, name: p.filename, size: p.body.size ?? 0, mimeType: p.mimeType });
    return;
  }
  if (p.mimeType === "text/html" && p.body?.data && !out.html) out.html = decode(p.body.data);
  else if (p.mimeType === "text/plain" && p.body?.data && !out.text) out.text = decode(p.body.data);
  for (const c of p.parts ?? []) walk(c, out);
}

function parseMessage(m: GMessage): FullMessage {
  const out: { html?: string; text?: string; attachments: Omit<Attachment, "messageId">[] } = { attachments: [] };
  if (m.payload) walk(m.payload, out);
  const from = hdr(m.payload, "From");
  return {
    id: m.id,
    from: displayName(from),
    fromEmail: from.match(/<([^>]+)>/)?.[1] ?? from,
    to: hdr(m.payload, "To"),
    cc: hdr(m.payload, "Cc"),
    replyTo: hdr(m.payload, "Reply-To"),
    subject: hdr(m.payload, "Subject"),
    date: new Date(Number(m.internalDate ?? 0)).toISOString(),
    html: out.html,
    text: out.text,
    snippet: decodeEntities(m.snippet ?? ""),
    unread: (m.labelIds ?? []).includes("UNREAD"),
    labels: m.labelIds ?? [],
    messageIdHeader: hdr(m.payload, "Message-ID"),
    references: hdr(m.payload, "References"),
    attachments: out.attachments.map((a) => ({ ...a, messageId: m.id })),
  };
}

export async function getThread(b: Business, id: string) {
  const t = await api<{ id: string; messages: GMessage[] }>(b, `threads/${encodeURIComponent(id)}?format=full`);
  const messages = t.messages.map(parseMessage);
  return { id: t.id, businessId: b.id, subject: messages[0]?.subject || "(no subject)", messages };
}

export async function getDraft(b: Business, draftId: string) {
  const d = await api<{ id: string; message: GMessage }>(b, `drafts/${encodeURIComponent(draftId)}?format=full`);
  const m = parseMessage(d.message);
  return {
    draftId: d.id,
    threadId: d.message.threadId,
    to: m.to,
    cc: m.cc,
    subject: m.subject,
    // The editor works in HTML. Unwrap the font wrapper we add when sending; plain-text drafts become paragraphs.
    body: m.html
      ? m.html.replace(/^<div style="font-family:[^"]*">([\s\S]*)<\/div>$/, "$1")
      : (m.text ?? "")
          .replace(/\r\n/g, "\n")
          .split("\n")
          .map((l) => `<p>${l.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`)
          .join(""),
    inReplyTo: hdr(d.message.payload, "In-Reply-To"),
    references: hdr(d.message.payload, "References"),
  };
}

export async function getAttachment(b: Business, messageId: string, attachmentId: string) {
  const r = await api<{ data: string; size: number }>(b, `messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`);
  return Buffer.from(r.data.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

export type ThreadAction = "archive" | "inbox" | "trash" | "untrash" | "spam" | "notspam" | "read" | "unread" | "star" | "unstar";

export async function threadAction(b: Business, id: string, action: ThreadAction) {
  const path = `threads/${encodeURIComponent(id)}`;
  const modify = (addLabelIds: string[], removeLabelIds: string[]) =>
    api(b, `${path}/modify`, { method: "POST", body: JSON.stringify({ addLabelIds, removeLabelIds }) });
  switch (action) {
    case "archive":
      return modify([], ["INBOX"]);
    case "inbox":
      return modify(["INBOX"], []);
    case "trash":
      return api(b, `${path}/trash`, { method: "POST" });
    case "untrash":
      return api(b, `${path}/untrash`, { method: "POST" });
    case "spam":
      return modify(["SPAM"], ["INBOX"]);
    case "notspam":
      return modify(["INBOX"], ["SPAM"]);
    case "read":
      return modify([], ["UNREAD"]);
    case "unread":
      return modify(["UNREAD"], []);
    case "star":
      return modify(["STARRED"], []);
    case "unstar":
      return modify([], ["STARRED"]);
  }
}

export interface Outgoing {
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  body: string;
  threadId?: string;
  inReplyTo?: string;
  references?: string;
}

const cleanAddr = (s?: string) => (s ?? "").replace(/[\r\n]+/g, " ").trim();

const b64lines = (t: string) => Buffer.from(t, "utf8").toString("base64").replace(/.{76}/g, "$&\r\n");

/** Plain-text version of the editor's HTML, for mail apps that don't show HTML. */
function htmlToText(html: string) {
  return html
    .replace(/<li[^>]*>\s*<p>/gi, "<li>")
    .replace(/<\/p>\s*<\/li>/gi, "</li>")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<\/(p|li|h\d|blockquote|ul|ol)>/gi, "\n")
    .replace(/<a [^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, "$2 ($1)")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function raw(o: Outgoing) {
  const isHtml = /^\s*</.test(o.body);
  const html = isHtml
    ? `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5">${o.body.replace(/<blockquote>/g, '<blockquote style="margin:0 0 0 .8ex;border-left:1px solid #ccc;padding-left:1ex">')}</div>`
    : "";
  const text = isHtml ? htmlToText(o.body) : o.body;
  const boundary = `cc_${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  const lines = [
    `To: ${cleanAddr(o.to)}`,
    ...(cleanAddr(o.cc) ? [`Cc: ${cleanAddr(o.cc)}`] : []),
    ...(cleanAddr(o.bcc) ? [`Bcc: ${cleanAddr(o.bcc)}`] : []),
    `Subject: ${encWord(o.subject.replace(/[\r\n]+/g, " "))}`,
    ...(o.inReplyTo ? [`In-Reply-To: ${cleanAddr(o.inReplyTo)}`, `References: ${cleanAddr(o.references || o.inReplyTo)}`] : []),
    "MIME-Version: 1.0",
    ...(isHtml
      ? [
          `Content-Type: multipart/alternative; boundary="${boundary}"`,
          "",
          `--${boundary}`,
          'Content-Type: text/plain; charset="UTF-8"',
          "Content-Transfer-Encoding: base64",
          "",
          b64lines(text.replace(/\r?\n/g, "\r\n")),
          `--${boundary}`,
          'Content-Type: text/html; charset="UTF-8"',
          "Content-Transfer-Encoding: base64",
          "",
          b64lines(html),
          `--${boundary}--`,
        ]
      : ['Content-Type: text/plain; charset="UTF-8"', "Content-Transfer-Encoding: base64", "", b64lines(text.replace(/\r?\n/g, "\r\n"))]),
  ];
  return b64url(lines.join("\r\n"));
}

export async function sendMail(b: Business, o: Outgoing, draftId?: string) {
  if (!cleanAddr(o.to)) throw new MailError("Add at least one recipient", 400);
  if (draftId) {
    await api(b, `drafts/${encodeURIComponent(draftId)}`, { method: "PUT", body: JSON.stringify({ id: draftId, message: { raw: raw(o), threadId: o.threadId } }) });
    return api(b, "drafts/send", { method: "POST", body: JSON.stringify({ id: draftId }) });
  }
  return api(b, "messages/send", { method: "POST", body: JSON.stringify({ raw: raw(o), threadId: o.threadId }) });
}

export async function saveDraft(b: Business, o: Outgoing, draftId?: string) {
  const message = { raw: raw(o), threadId: o.threadId };
  if (draftId) return api<{ id: string }>(b, `drafts/${encodeURIComponent(draftId)}`, { method: "PUT", body: JSON.stringify({ id: draftId, message }) });
  return api<{ id: string }>(b, "drafts", { method: "POST", body: JSON.stringify({ message }) });
}

export async function deleteDraft(b: Business, draftId: string) {
  return api(b, `drafts/${encodeURIComponent(draftId)}`, { method: "DELETE" });
}
