"use client";
import { useEffect, useRef, useState } from "react";
import type { Business } from "@/lib/types";
import { Icon } from "../Icon";
import { BizMark } from "../BizMark";

export interface Draft {
  business: string;
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  body: string;
  threadId?: string;
  inReplyTo?: string;
  references?: string;
  draftId?: string;
}

/** Write, reply, forward or finish a draft. Saves to Gmail drafts as you type. */
export function Composer({
  initial,
  accounts,
  inline,
  onClose,
  onSent,
}: {
  initial: Draft;
  accounts: Business[];
  inline?: boolean;
  onClose: () => void;
  onSent: (msg: string) => void;
}) {
  const [d, setD] = useState<Draft>(initial);
  const [showCc, setShowCc] = useState(Boolean(initial.cc || initial.bcc));
  const [mode, setMode] = useState<"docked" | "min" | "full">("docked");
  const [state, setState] = useState<"idle" | "saving" | "saved" | "sending">("idle");
  const [error, setError] = useState<string | null>(null);
  const draftId = useRef(initial.draftId);
  const dirty = useRef(false);
  const latest = useRef(d);
  latest.current = d;

  const set = (p: Partial<Draft>) => {
    dirty.current = true;
    setD((x) => ({ ...x, ...p }));
  };

  const save = async () => {
    if (!dirty.current) return;
    const cur = latest.current;
    if (!cur.to.trim() && !cur.subject.trim() && !cur.body.trim()) return;
    dirty.current = false;
    setState("saving");
    const r = await fetch("/api/mail/draft", { method: "POST", body: JSON.stringify({ ...cur, draftId: draftId.current }) }).catch(() => null);
    const j = (await r?.json().catch(() => null)) as { draftId?: string; error?: string } | null;
    if (j?.draftId) {
      draftId.current = j.draftId;
      setState("saved");
    } else {
      setState("idle");
      setError(j?.error ?? null);
    }
  };

  // Autosave a couple of seconds after typing stops.
  useEffect(() => {
    if (!dirty.current) return;
    const t = setTimeout(save, 2500);
    return () => clearTimeout(t);
  }, [d]);

  const send = async () => {
    if (!d.to.trim()) return setError("Add at least one recipient");
    setState("sending");
    setError(null);
    const r = await fetch("/api/mail/send", { method: "POST", body: JSON.stringify({ ...d, draftId: draftId.current }) }).catch(() => null);
    const j = (await r?.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    if (r?.ok && j?.ok) return onSent("Sent");
    setState("idle");
    setError(j?.error ?? "Couldn't send. Try again.");
  };

  const discard = async () => {
    dirty.current = false;
    if (draftId.current) await fetch(`/api/mail/draft?business=${d.business}&id=${encodeURIComponent(draftId.current)}`, { method: "DELETE" }).catch(() => {});
    onClose();
  };

  const close = async () => {
    await save();
    onClose();
  };

  const title = d.subject.trim() || (inline ? "Reply" : "New message");
  const field = "w-full bg-transparent py-2 text-[14px] outline-none placeholder:text-faint";
  const biz = accounts.find((a) => a.id === d.business);

  const hbtn = "inline-flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-[var(--border)] hover:text-ink";
  return (
    <>
    {mode === "full" && <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setMode("docked")} />}
    <div
      className={
        mode === "full"
          ? "fixed left-1/2 top-1/2 z-50 flex h-[min(820px,90vh)] w-[min(960px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-2xl"
          : mode === "min"
            ? "fixed bottom-0 right-4 z-50 w-[300px] overflow-hidden rounded-t-xl border border-b-0 border-line bg-surface shadow-2xl"
            : "fixed bottom-0 right-4 z-50 flex max-h-[85vh] w-[min(560px,calc(100vw-2rem))] flex-col overflow-hidden rounded-t-xl border border-b-0 border-line bg-surface shadow-2xl"
      }
      onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") send();
        if (e.key !== "Escape") return;
        if (mode === "full") setMode("docked");
        else close();
      }}
    >
      <div
        onClick={() => mode === "min" && setMode("docked")}
        className={`flex shrink-0 items-center gap-1 bg-sidebar py-2 pl-4 pr-2 text-[14px] font-medium ${mode === "min" ? "cursor-pointer" : ""}`}
      >
        <span className="min-w-0 flex-1 truncate">{title}</span>
        <button onClick={(e) => (e.stopPropagation(), setMode(mode === "min" ? "docked" : "min"))} className={hbtn} title={mode === "min" ? "Open" : "Minimize"}>
          <Icon name="minimize" size={15} />
        </button>
        <button onClick={(e) => (e.stopPropagation(), setMode(mode === "full" ? "docked" : "full"))} className={hbtn} title={mode === "full" ? "Exit full screen" : "Pop out"}>
          <Icon name={mode === "full" ? "shrink" : "expand"} size={14} />
        </button>
        <button onClick={(e) => (e.stopPropagation(), close())} className={hbtn} title="Save and close">
          <Icon name="x" size={15} />
        </button>
      </div>
      <div className={mode === "min" ? "hidden" : "contents"}>
      <div className="flex min-h-0 flex-1 flex-col px-4">
        <div className="flex items-center gap-2 border-b border-line">
          <span className="w-12 shrink-0 text-[13px] text-faint">From</span>
          {initial.threadId || initial.draftId ? (
            <span className="flex items-center gap-1.5 py-2 text-[14px]">
              {biz && <BizMark business={biz} size={16} />} {biz?.name}
            </span>
          ) : (
            <select value={d.business} onChange={(e) => set({ business: e.target.value })} className={`${field} cursor-pointer`}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="flex items-center gap-2 border-b border-line">
          <span className="w-12 shrink-0 text-[13px] text-faint">To</span>
          <input autoFocus={!d.to} value={d.to} onChange={(e) => set({ to: e.target.value })} className={field} placeholder="name@example.com, …" />
          {!showCc && (
            <button onClick={() => setShowCc(true)} className="shrink-0 text-[13px] text-muted hover:text-ink">
              Cc Bcc
            </button>
          )}
        </div>
        {showCc && (
          <>
            <div className="flex items-center gap-2 border-b border-line">
              <span className="w-12 shrink-0 text-[13px] text-faint">Cc</span>
              <input value={d.cc ?? ""} onChange={(e) => set({ cc: e.target.value })} className={field} />
            </div>
            <div className="flex items-center gap-2 border-b border-line">
              <span className="w-12 shrink-0 text-[13px] text-faint">Bcc</span>
              <input value={d.bcc ?? ""} onChange={(e) => set({ bcc: e.target.value })} className={field} />
            </div>
          </>
        )}
        {!inline && (
          <div className="flex items-center gap-2 border-b border-line">
            <span className="w-12 shrink-0 text-[13px] text-faint">Subject</span>
            <input value={d.subject} onChange={(e) => set({ subject: e.target.value })} className={field} />
          </div>
        )}
        <textarea
          autoFocus={Boolean(d.to)}
          value={d.body}
          onChange={(e) => set({ body: e.target.value })}
          onFocus={(e) => {
            // Put the cursor above any quoted text.
            if (initial.body.startsWith("\n\n") && e.currentTarget.selectionStart === e.currentTarget.value.length) e.currentTarget.setSelectionRange(0, 0);
          }}
          rows={mode === "full" ? 20 : 12}
          className="min-h-[140px] w-full flex-1 resize-y bg-transparent py-3 text-[14px] leading-relaxed outline-none placeholder:text-faint"
          placeholder="Write your message…"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-2.5">
        <button onClick={send} disabled={state === "sending"} className="btn btn-primary">
          <Icon name="send" size={14} /> {state === "sending" ? "Sending…" : "Send"}
        </button>
        <span className="text-[12px] text-faint">{state === "saving" ? "Saving draft…" : state === "saved" ? "Draft saved" : "⌘↵ to send"}</span>
        {error && <span className="text-[13px] text-bad">{error}</span>}
        <div className="ml-auto flex items-center gap-1">
          <button onClick={discard} className="btn btn-ghost" title="Discard draft">
            <Icon name="trash" size={15} />
          </button>
        </div>
      </div>
      </div>
    </div>
    </>
  );
}
