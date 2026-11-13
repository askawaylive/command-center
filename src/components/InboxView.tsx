"use client";
import { useState } from "react";
import type { Business, Email } from "@/lib/types";
import { Icon } from "./Icon";
import { BizMark } from "./BizMark";

export function InboxView({ emails, businesses, fixedBusiness }: { emails: Email[]; businesses: Business[]; fixedBusiness?: string }) {
  const [biz, setBiz] = useState(fixedBusiness ?? "all");
  const [planned, setPlanned] = useState<Set<string>>(new Set());
  const [replying, setReplying] = useState<string | null>(null);
  const [sent, setSent] = useState<Set<string>>(new Set());
  const byId = Object.fromEntries(businesses.map((b) => [b.id, b]));
  const list = emails.filter((e) => biz === "all" || e.businessId === biz);
  const unread = (id?: string) => emails.filter((e) => e.unread && (!id || e.businessId === id)).length;

  const plan = async (e: Email) => {
    await fetch("/api/tasks", {
      method: "POST",
      body: JSON.stringify({ title: `Follow up: ${e.subject}`, businessId: e.businessId, plannedFor: new Date().toLocaleDateString("en-CA"), estimateMin: 15, notes: `From ${e.from}` }),
    });
    setPlanned((s) => new Set(s).add(e.id));
  };

  return (
    <div className="px-8 pb-10">
      {!fixedBusiness && (
        <div className="mb-5 flex flex-wrap gap-1 border-b border-line">
          {[{ id: "all", name: "All inboxes", color: "" }, ...businesses].map((b) => (
            <button
              key={b.id}
              onClick={() => setBiz(b.id)}
              className={`-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-[14px] ${biz === b.id ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink"}`}
            >
              {"sources" in b && <BizMark business={b} size={18} />}
              {b.name}
              {unread(b.id === "all" ? undefined : b.id) > 0 && <span className="ml-1.5 text-[12px] text-accent">{unread(b.id === "all" ? undefined : b.id)}</span>}
            </button>
          ))}
        </div>
      )}
      <div className="card divide-y divide-[var(--border)] overflow-hidden">
        {list.length === 0 && <div className="p-6 text-muted">No emails here. If an inbox isn&apos;t connected yet, connect it on the <a href="/settings" className="underline">Connections</a> page.</div>}
        {list.map((e) => (
          <div key={e.id}>
          <div className="group flex items-start gap-3 px-5 py-3.5 hover:bg-bg">
            <span className="mt-2 h-2 w-2 shrink-0 rounded-full" style={{ background: e.unread ? "var(--accent)" : "transparent" }} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-[13px]">
                {byId[e.businessId] && (
                  <span title={byId[e.businessId].name} className="shrink-0">
                    <BizMark business={byId[e.businessId]} size={18} />
                  </span>
                )}
                <span className={e.unread ? "font-semibold" : "text-muted"}>{e.from}</span>
                <span className="ml-auto shrink-0 text-[12px] text-faint">
                  {new Date(e.date).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                </span>
              </div>
              <div className={`mt-0.5 text-[14px] ${e.unread ? "font-medium" : ""}`}>{e.subject}</div>
              <div className="truncate text-[13px] text-muted">{e.snippet}</div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1 opacity-0 group-hover:opacity-100">
              {e.live && (
                <button onClick={() => setReplying(replying === e.id ? null : e.id)} className="inline-flex items-center gap-1 text-[12px] text-accent">
                  <Icon name={sent.has(e.id) ? "check" : "send"} size={12} /> {sent.has(e.id) ? "Replied" : "Reply"}
                </button>
              )}
              {e.live && (
                <a className="text-[12px] text-muted hover:text-accent" href={`https://mail.google.com/mail/u/0/#all/${e.id}`} target="_blank" rel="noreferrer">
                  Open in Gmail
                </a>
              )}
              <button onClick={() => plan(e)} disabled={planned.has(e.id)} className="inline-flex items-center gap-1 text-[12px] text-accent">
                <Icon name={planned.has(e.id) ? "check" : "plus"} size={12} /> {planned.has(e.id) ? "Planned" : "Plan for today"}
              </button>
            </div>
          </div>
          {replying === e.id && (
            <ReplyBox
              email={e}
              onClose={() => setReplying(null)}
              onSent={() => {
                setSent((s) => new Set(s).add(e.id));
                setReplying(null);
              }}
            />
          )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ReplyBox({ email, onClose, onSent }: { email: Email; onClose: () => void; onSent: () => void }) {
  const [body, setBody] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "error">("idle");
  const [error, setError] = useState<{ msg: string; reconnect?: boolean } | null>(null);

  if (!email.canReply)
    return (
      <div className="border-t border-line bg-bg px-5 py-3 pl-10 text-[13px] text-muted">
        To reply from here, click <b className="text-ink">Reconnect</b> for this inbox on the{" "}
        <a href="/settings" className="text-accent underline">Connections</a> page once, so Google allows sending.
      </div>
    );

  const send = async () => {
    if (!body.trim() || state === "sending") return;
    setState("sending");
    setError(null);
    const r = await fetch("/api/gmail/reply", { method: "POST", body: JSON.stringify({ businessId: email.businessId, emailId: email.id, body }) }).catch(() => null);
    const j = (await r?.json().catch(() => null)) as { ok?: boolean; error?: string; reconnect?: boolean } | null;
    if (r?.ok && j?.ok) return onSent();
    setState("error");
    setError({ msg: j?.error ?? "Couldn't send. Check your connection and try again.", reconnect: j?.reconnect });
  };

  return (
    <div className="border-t border-line bg-bg px-5 py-3 pl-10">
      <div className="mb-1.5 text-[12px] text-faint">
        Reply to <span className="text-muted">{email.from}</span> · Re: {email.subject.replace(/^re:\s*/i, "")}
      </div>
      <textarea
        autoFocus
        value={body}
        onChange={(ev) => setBody(ev.target.value)}
        onKeyDown={(ev) => {
          if ((ev.metaKey || ev.ctrlKey) && ev.key === "Enter") send();
          if (ev.key === "Escape") onClose();
        }}
        rows={5}
        placeholder="Write your reply…"
        className="w-full resize-y rounded-lg border border-line bg-surface p-3 text-[14px] leading-relaxed outline-none focus:border-accent"
      />
      <div className="mt-2 flex items-center gap-2">
        <button onClick={send} disabled={!body.trim() || state === "sending"} className="btn btn-primary">
          {state === "sending" ? "Sending…" : "Send"}
        </button>
        <button onClick={onClose} className="btn btn-ghost">Cancel</button>
        <span className="text-[12px] text-faint">⌘↵ to send</span>
        {error && (
          <span className="ml-auto text-[13px] text-bad">
            {error.msg}
            {error.reconnect && (
              <>
                {" "}
                <a href="/settings" className="underline">Go to Connections</a>
              </>
            )}
          </span>
        )}
      </div>
    </div>
  );
}
