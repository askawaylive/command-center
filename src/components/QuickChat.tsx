"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Chat } from "./Chat";
import { Icon } from "./Icon";

/** Floating "Ask Claude" button that opens a quick chat panel on any page. */
export function QuickChat() {
  const [open, setOpen] = useState(false);
  const path = usePathname();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (path === "/agent" || path === "/login") return null;

  return (
    <>
      {open && (
        <div className="fixed bottom-24 right-4 z-40 flex h-[min(600px,calc(100vh-8rem))] w-[min(420px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-line bg-bg shadow-[0_12px_48px_rgba(0,0,0,0.18)]">
          <div className="flex items-center gap-2 border-b border-line px-4 py-3">
            <span className="text-accent"><Icon name="spark" size={16} /></span>
            <span className="font-serif text-[17px]">Ask Claude</span>
            <Link href="/agent" onClick={() => setOpen(false)} className="ml-auto text-[12px] text-faint hover:text-accent">Full screen</Link>
            <button onClick={() => setOpen(false)} aria-label="Close chat" className="ml-2 text-faint hover:text-ink text-[18px] leading-none">×</button>
          </div>
          <div className="min-h-0 flex-1">
            <Chat compact />
          </div>
        </div>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close Ask Claude" : "Ask Claude"}
        title="Ask Claude (⌘K)"
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-accent px-4 py-3 text-[14px] font-medium text-white shadow-[0_6px_24px_rgba(201,100,66,0.45)] transition-transform hover:scale-[1.03] hover:bg-accent-hover"
      >
        <Icon name="spark" size={17} />
        {open ? "Close" : "Ask Claude"}
      </button>
    </>
  );
}
