"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "./Icon";

type Turn = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "How did each business do this month compared to last?",
  "What's on my plate today, and what should I do first?",
  "Which emails need a reply from me?",
  "How much cash do I have across Mercury?",
  "Add a task to Little Tan: reorder Glow Drops, tomorrow, high priority",
];

/** Minimal markdown: paragraphs, bullet/numbered lists, **bold**. */
function Markdown({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  const inline = (s: string) =>
    s.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : <span key={i}>{part}</span>,
    );
  return (
    <div className="space-y-3">
      {blocks.map((b, i) => {
        const lines = b.split("\n");
        if (lines.every((l) => /^\s*([-*]|\d+\.)\s/.test(l))) {
          const ordered = /^\s*\d+\./.test(lines[0]);
          const Tag = ordered ? "ol" : "ul";
          return (
            <Tag key={i} className={`${ordered ? "list-decimal" : "list-disc"} pl-5 space-y-1`}>
              {lines.map((l, j) => <li key={j}>{inline(l.replace(/^\s*([-*]|\d+\.)\s/, ""))}</li>)}
            </Tag>
          );
        }
        if (/^#{1,3}\s/.test(b)) return <h3 key={i} className="font-serif text-[18px]">{b.replace(/^#+\s/, "")}</h3>;
        return <p key={i} className="whitespace-pre-wrap">{inline(b)}</p>;
      })}
    </div>
  );
}

export function Chat() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, busy]);

  const send = async (text: string) => {
    if (!text.trim() || busy) return;
    const next = [...turns, { role: "user" as const, content: text.trim() }];
    setTurns(next);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/agent", { method: "POST", body: JSON.stringify({ messages: next }) });
      const data = (await res.json()) as { text: string; changed?: boolean };
      setTurns([...next, { role: "assistant", content: data.text }]);
      if (data.changed) router.refresh();
    } catch {
      setTurns([...next, { role: "assistant", content: "I couldn't reach the server. Is the app still running?" }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col px-6">
      <div className="flex-1 py-10">
        {turns.length === 0 ? (
          <div className="pt-[12vh] text-center">
            <span className="inline-flex text-accent"><Icon name="spark" size={34} /></span>
            <h1 className="mt-3 font-serif text-[34px] tracking-tight">What would you like to know?</h1>
            <p className="mt-2 text-muted">I can see your revenue, bank balances, tasks, and inboxes across every business.</p>
            <div className="mt-8 flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => send(s)} className="rounded-full border border-line bg-surface px-3.5 py-1.5 text-[13px] text-muted hover:border-accent hover:text-ink">
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-6 text-[15px] leading-relaxed">
            {turns.map((t, i) =>
              t.role === "user" ? (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[80%] rounded-2xl bg-sidebar px-4 py-2.5">{t.content}</div>
                </div>
              ) : (
                <div key={i} className="flex gap-3">
                  <span className="mt-1 text-accent shrink-0"><Icon name="spark" size={18} /></span>
                  <div className="min-w-0 flex-1"><Markdown text={t.content} /></div>
                </div>
              ),
            )}
            {busy && (
              <div className="flex items-center gap-3 text-muted">
                <span className="text-accent animate-pulse"><Icon name="spark" size={18} /></span> Looking into it…
              </div>
            )}
            <div ref={end} />
          </div>
        )}
      </div>
      <div className="sticky bottom-0 bg-bg pb-6 pt-2">
        <div className="card flex items-end gap-2 p-2 shadow-[0_4px_20px_rgba(0,0,0,0.05)]">
          <textarea
            rows={1}
            className="max-h-40 flex-1 resize-none bg-transparent px-2 py-2 text-[15px] outline-none"
            placeholder="Ask about revenue, tasks, email…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
          />
          <button onClick={() => send(input)} disabled={busy || !input.trim()} className="btn btn-primary !p-2.5 disabled:opacity-40" aria-label="Send">
            <Icon name="arrowUp" size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
