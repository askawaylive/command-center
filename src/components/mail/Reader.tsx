"use client";
import { useEffect, useRef, useState } from "react";
import type { Business } from "@/lib/types";
import type { FullMessage } from "@/lib/mail";
import { Icon } from "../Icon";
import { BizMark } from "../BizMark";
import { Composer, type Draft } from "./Composer";

export interface Thread {
  id: string;
  businessId: string;
  subject: string;
  messages: FullMessage[];
}

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

const size = (n: number) => (n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1e3))} KB`);

function plain(m: FullMessage) {
  if (m.text) return m.text;
  if (!m.html) return m.snippet;
  return m.html
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|h\d|li)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Email HTML runs in a sandbox with no scripts, forms or access to the app. */
function HtmlBody({ html }: { html: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [h, setH] = useState(120);
  const doc = `<!doctype html><html><head><meta charset="utf-8"><base target="_blank"><meta name="color-scheme" content="light"><style>html,body{margin:0;padding:0;background:#fff;color:#1f1e1d;font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Inter,sans-serif;word-wrap:break-word}img{max-width:100%;height:auto}table{max-width:100%}blockquote{margin:0 0 0 .8ex;border-left:1px solid #ccc;padding-left:1ex}</style></head><body>${html}</body></html>`;
  const measure = () => {
    const d = ref.current?.contentDocument;
    if (d?.body) setH(Math.min(20000, Math.max(60, d.documentElement.scrollHeight)));
  };
  useEffect(() => {
    const t = [300, 1000, 2500].map((ms) => setTimeout(measure, ms));
    return () => t.forEach(clearTimeout);
  }, [html]);
  return (
    <iframe
      ref={ref}
      title="Email"
      sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin"
      srcDoc={doc}
      onLoad={measure}
      style={{ height: h }}
      className="w-full rounded-lg bg-white p-0"
    />
  );
}

function Message({ m, businessId, open, onToggle }: { m: FullMessage; businessId: string; open: boolean; onToggle: () => void }) {
  return (
    <div className="border-b border-line py-4 last:border-b-0">
      <button onClick={onToggle} className="flex w-full items-start gap-3 text-left">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sidebar text-[13px] font-medium text-muted">
          {(m.from || "?").trim()[0]?.toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="truncate font-medium">{m.from}</span>
            <span className="truncate text-[12px] text-faint">{m.fromEmail !== m.from ? `<${m.fromEmail}>` : ""}</span>
            <span className="ml-auto shrink-0 text-[12px] text-faint">{when(m.date)}</span>
          </div>
          {open ? (
            <div className="truncate text-[12px] text-muted">
              to {m.to}
              {m.cc ? `, cc ${m.cc}` : ""}
            </div>
          ) : (
            <div className="truncate text-[13px] text-muted">{m.snippet}</div>
          )}
        </div>
      </button>
      {open && (
        <div className="mt-3 pl-11">
          {m.html ? <HtmlBody html={m.html} /> : <div className="whitespace-pre-wrap break-words text-[14px] leading-relaxed">{m.text || m.snippet}</div>}
          {m.attachments.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {m.attachments.map((a) => (
                <a
                  key={a.id}
                  href={`/api/mail/attachment?business=${businessId}&message=${m.id}&id=${encodeURIComponent(a.id)}&name=${encodeURIComponent(a.name)}`}
                  className="inline-flex max-w-[260px] items-center gap-2 rounded-lg border border-line px-3 py-2 text-[13px] hover:bg-sidebar"
                >
                  <Icon name="clip" size={14} />
                  <span className="truncate">{a.name}</span>
                  <span className="shrink-0 text-[11px] text-faint">{size(a.size)}</span>
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export type ReaderAction = "archive" | "inbox" | "trash" | "untrash" | "spam" | "notspam" | "unread" | "star" | "unstar";

export function Reader({
  thread,
  folder,
  business,
  accounts,
  myEmail,
  starred,
  onAction,
  onBack,
  onSent,
}: {
  thread: Thread;
  folder: string;
  business?: Business;
  accounts: Business[];
  myEmail: string;
  starred: boolean;
  onAction: (a: ReaderAction) => void;
  onBack: () => void;
  onSent: (msg: string) => void;
}) {
  const last = thread.messages.length - 1;
  const [open, setOpen] = useState<Set<number>>(() => new Set([last, ...thread.messages.map((m, i) => (m.unread ? i : -1)).filter((i) => i >= 0)]));
  const [compose, setCompose] = useState<Draft | null>(null);

  useEffect(() => {
    setOpen(new Set([thread.messages.length - 1]));
    setCompose(null);
  }, [thread.id, thread.messages.length]);

  const startReply = (kind: "reply" | "all" | "forward") => {
    const me = myEmail.toLowerCase();
    // Reply to the latest message from someone else; fall back to the latest one.
    const m = [...thread.messages].reverse().find((x) => x.fromEmail.toLowerCase() !== me) ?? thread.messages[last];
    const quoted = plain(m)
      .split("\n")
      .slice(0, 400)
      .map((l) => `> ${l}`)
      .join("\n");
    const base = { business: thread.businessId, threadId: thread.id };
    const subj = thread.subject.replace(/^(re|fwd?):\s*/i, "");
    if (kind === "forward") {
      setCompose({
        ...base,
        threadId: undefined,
        to: "",
        subject: `Fwd: ${subj}`,
        body: `\n\n---------- Forwarded message ---------\nFrom: ${m.from} <${m.fromEmail}>\nDate: ${when(m.date)}\nSubject: ${m.subject}\nTo: ${m.to}\n\n${plain(m)}`,
      });
      return;
    }
    const sentByMe = m.fromEmail.toLowerCase() === me;
    const to = sentByMe ? m.to : m.replyTo || `${m.from} <${m.fromEmail}>`;
    const others =
      kind === "all"
        ? [m.to, m.cc]
            .join(",")
            .split(",")
            .map((s) => s.trim())
            .filter((s) => s && !s.toLowerCase().includes(me) && !to.toLowerCase().includes(s.toLowerCase()))
            .join(", ")
        : "";
    setCompose({
      ...base,
      to,
      cc: others,
      subject: /^re:/i.test(thread.subject) ? thread.subject : `Re: ${subj}`,
      body: `\n\nOn ${when(m.date)}, ${m.from} wrote:\n${quoted}`,
      inReplyTo: m.messageIdHeader,
      references: [m.references, m.messageIdHeader].filter(Boolean).join(" "),
    });
  };

  const btn = "inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-sidebar hover:text-ink";
  const inTrash = folder === "trash";
  const inSpam = folder === "spam";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-1 border-b border-line px-4 py-2">
        <button onClick={onBack} className={btn} title="Back (u)">
          <Icon name="chevronLeft" size={17} />
        </button>
        <span className="mx-1 h-5 w-px bg-line" />
        {folder === "inbox" || folder === "starred" ? (
          <button onClick={() => onAction("archive")} className={btn} title="Archive (e)">
            <Icon name="archive" size={17} />
          </button>
        ) : !inTrash && !inSpam ? (
          <button onClick={() => onAction("inbox")} className={btn} title="Move to Inbox">
            <Icon name="inbox" size={17} />
          </button>
        ) : null}
        {inSpam ? (
          <button onClick={() => onAction("notspam")} className="btn btn-ghost h-8 text-[13px]" title="Not spam">
            Not spam
          </button>
        ) : (
          !inTrash && (
            <button onClick={() => onAction("spam")} className={btn} title="Report spam (!)">
              <Icon name="spam" size={17} />
            </button>
          )
        )}
        {inTrash ? (
          <button onClick={() => onAction("untrash")} className="btn btn-ghost h-8 text-[13px]" title="Restore from Trash">
            <Icon name="undo" size={15} /> Restore
          </button>
        ) : (
          <button onClick={() => onAction("trash")} className={btn} title="Delete (#)">
            <Icon name="trash" size={17} />
          </button>
        )}
        <button onClick={() => onAction("unread")} className={btn} title="Mark unread">
          <Icon name="mail" size={17} />
        </button>
        <button onClick={() => onAction(starred ? "unstar" : "star")} className={`${btn} ${starred ? "text-[#e3a008]" : ""}`} title={starred ? "Unstar" : "Star (s)"}>
          <Icon name="star" size={17} className={starred ? "fill-current" : ""} />
        </button>
        {business && (
          <span className="ml-auto flex items-center gap-1.5 text-[12px] text-muted">
            <BizMark business={business} size={16} /> {business.name}
          </span>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto scroll-thin px-6 pb-24">
        <h2 className="pt-5 pb-1 font-serif text-[24px] leading-tight">{thread.subject}</h2>
        {thread.messages.map((m, i) => (
          <Message
            key={m.id}
            m={m}
            businessId={thread.businessId}
            open={open.has(i)}
            onToggle={() =>
              setOpen((s) => {
                const n = new Set(s);
                if (n.has(i)) n.delete(i);
                else n.add(i);
                return n;
              })
            }
          />
        ))}
        {compose && (
          <Composer
            key={`${compose.inReplyTo ?? ""}${compose.subject}${compose.cc ?? ""}`}
            initial={compose}
            accounts={accounts}
            inline={Boolean(compose.threadId)}
            onClose={() => setCompose(null)}
            onSent={(msg) => {
              setCompose(null);
              onSent(msg);
            }}
          />
        )}
        {!inTrash && (
            <div className="mt-4 flex flex-wrap gap-2 pl-11">
              <button onClick={() => startReply("reply")} className="btn border border-line" title="Reply (r)">
                <Icon name="reply" size={15} /> Reply
              </button>
              <button onClick={() => startReply("all")} className="btn border border-line" title="Reply all (a)">
                <Icon name="replyAll" size={15} /> Reply all
              </button>
              <button onClick={() => startReply("forward")} className="btn border border-line" title="Forward (f)">
                <Icon name="forward" size={15} /> Forward
              </button>
            </div>
        )}
      </div>
      <KeyHandler onKey={(k) => (k === "r" ? startReply("reply") : k === "a" ? startReply("all") : k === "f" ? startReply("forward") : null)} enabled={!compose} />
    </div>
  );
}

function KeyHandler({ onKey, enabled }: { onKey: (k: string) => void; enabled: boolean }) {
  const cb = useRef(onKey);
  cb.current = onKey;
  useEffect(() => {
    if (!enabled) return;
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || t.closest("input,textarea,select,[contenteditable=true]")) return;
      if (["r", "a", "f"].includes(e.key)) {
        e.preventDefault();
        cb.current(e.key);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [enabled]);
  return null;
}
