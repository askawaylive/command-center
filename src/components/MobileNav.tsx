"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { Business } from "@/lib/types";
import { Icon } from "./Icon";
import { BizMark } from "./BizMark";
import { ThemeToggle } from "./ThemeToggle";

const TABS = [
  { href: "/", label: "Today", icon: "sun" },
  { href: "/board", label: "Board", icon: "board" },
  { href: "/inbox", label: "Inbox", icon: "mail" },
  { href: "/notes", label: "Notes", icon: "note" },
];
const MORE = [
  { href: "/dashboard", label: "Metrics", icon: "chart" },
  { href: "/contacts", label: "Contacts", icon: "users" },
  { href: "/mindmap", label: "Mind Map", icon: "map" },
  { href: "/agent", label: "Ask Claude", icon: "spark" },
  { href: "/settings", label: "Connections", icon: "gear" },
];
const TITLES: Record<string, string> = Object.fromEntries([...TABS, ...MORE, { href: "/businesses", label: "Businesses" }].map((n) => [n.href, n.label]));

const isActive = (path: string, href: string) => (href === "/" ? path === "/" : path.startsWith(href));

/** Phone navigation: a slim top bar, a bottom tab bar for the main pages, and a menu sheet for everything else. */
export function MobileNav({ businesses, signOut }: { businesses: Business[]; signOut?: boolean }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
  }, [open]);
  if (path === "/login") return null;

  const biz = businesses.find((b) => path === `/business/${b.id}`);
  const title = biz?.name ?? TITLES[Object.keys(TITLES).find((h) => isActive(path, h) && h !== "/") ?? (path === "/" ? "/" : "")] ?? "Command Center";

  return (
    <>
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-line bg-bg px-3 md:hidden">
        <button onClick={() => setOpen(true)} aria-label="Open menu" className="-ml-1 rounded-lg p-2 text-muted active:bg-sidebar">
          <Icon name="list" size={20} />
        </button>
        {biz ? <BizMark business={biz} size={22} /> : <span className="text-accent"><Icon name="spark" size={16} /></span>}
        <span className="truncate text-[15px] font-semibold">{title}</span>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-bg/95 backdrop-blur md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label="Main"
      >
        {TABS.map((t) => (
          <Link key={t.href} href={t.href} className={`flex flex-1 flex-col items-center gap-0.5 pb-1.5 pt-2 text-[11px] ${isActive(path, t.href) ? "text-accent" : "text-muted"}`}>
            <Icon name={t.icon} size={21} />
            {t.label}
          </Link>
        ))}
        <button onClick={() => setOpen(true)} className={`flex flex-1 flex-col items-center gap-0.5 pb-1.5 pt-2 text-[11px] ${open ? "text-accent" : "text-muted"}`}>
          <Icon name="grid" size={21} />
          More
        </button>
      </nav>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-label="Menu">
          <button className="absolute inset-0 bg-black/30" aria-label="Close menu" onClick={() => setOpen(false)} />
          <div
            className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-3xl border-t border-line bg-bg px-4 pt-3"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)" }}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" />
            <div className="grid grid-cols-3 gap-2">
              {[...TABS, ...MORE].map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`flex flex-col items-center gap-1.5 rounded-2xl border px-2 py-3 text-[12px] ${isActive(path, n.href) ? "border-accent text-accent" : "border-line bg-surface text-ink"}`}
                >
                  <Icon name={n.icon} size={20} />
                  {n.label}
                </Link>
              ))}
            </div>
            <div className="mt-5 flex items-center justify-between px-1 pb-2">
              <span className="text-[11px] font-medium uppercase tracking-wider text-faint">Businesses</span>
              <Link href="/businesses" className="text-[12px] text-faint">Manage</Link>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {businesses.map((b) => (
                <Link
                  key={b.id}
                  href={`/business/${b.id}`}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-[14px] ${path === `/business/${b.id}` ? "border-accent" : "border-line bg-surface"}`}
                >
                  <BizMark business={b} size={22} />
                  <span className="truncate">{b.name}</span>
                </Link>
              ))}
            </div>
            <div className="mt-5 flex items-center justify-between px-1">
              {signOut ? (
                <button
                  onClick={async () => {
                    await fetch("/api/logout", { method: "POST" });
                    window.location.href = "/login";
                  }}
                  className="text-[13px] text-muted"
                >
                  Sign out
                </button>
              ) : (
                <span />
              )}
              <ThemeToggle />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
