"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Business } from "@/lib/types";
import { Icon } from "./Icon";
import { BizMark } from "./BizMark";
import { ThemeToggle } from "./ThemeToggle";
import { PixelClock } from "./PixelClock";

const NAV = [
  { href: "/", label: "Today", icon: "sun" },
  { href: "/board", label: "Launch board", icon: "board" },
  { href: "/dashboard", label: "Metrics", icon: "chart" },
  { href: "/inbox", label: "Inbox", icon: "mail" },
  { href: "/notes", label: "Notes", icon: "note" },
  { href: "/contacts", label: "Contacts", icon: "users" },
  { href: "/mindmap", label: "Mind Map", icon: "map" },
  { href: "/agent", label: "Ask Claude", icon: "spark" },
];

export function Sidebar({ businesses, signOut }: { businesses: Business[]; signOut?: boolean }) {
  const path = usePathname();
  const item = (active: boolean) =>
    `flex items-center gap-2.5 rounded-lg px-3 py-2 text-[14px] transition-colors ${
      active ? "bg-surface text-ink shadow-[0_1px_2px_rgba(0,0,0,0.04)] border border-line" : "text-muted hover:text-ink hover:bg-surface/60 border border-transparent"
    }`;
  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col overflow-y-auto scroll-thin bg-sidebar border-r border-line px-3 py-5">
      <div className="px-3 pb-6 flex items-center gap-2">
        <span className="text-accent"><Icon name="spark" size={20} /></span>
        <span className="font-serif text-[19px] tracking-tight">Command Center</span>
      </div>
      <nav className="flex flex-col gap-1">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className={item(n.href === "/" ? path === "/" : path.startsWith(n.href))}>
            <Icon name={n.icon} /> {n.label}
          </Link>
        ))}
      </nav>
      <div className="mt-8 flex items-center justify-between px-3 pb-2">
        <span className="text-[11px] font-medium uppercase tracking-wider text-faint">Businesses</span>
        <Link href="/businesses" className={`text-[11px] ${path === "/businesses" ? "text-accent" : "text-faint hover:text-accent"}`}>
          Manage
        </Link>
      </div>
      <nav className="flex flex-col gap-1">
        {businesses.map((b) => (
          <Link key={b.id} href={`/business/${b.id}`} className={item(path === `/business/${b.id}`)}>
            <BizMark business={b} size={18} /> <span className="truncate">{b.name}</span>
          </Link>
        ))}
      </nav>
      <div className="mt-auto pt-6">
        <div className="mb-2 px-3">
          <PixelClock fluid />
        </div>
        <Link href="/settings" className={item(path === "/settings")}>
          <Icon name="gear" /> Connections
        </Link>
        <div className="mt-2 flex items-center justify-between pl-3">
          {signOut ? (
            <button
              onClick={async () => {
                await fetch("/api/logout", { method: "POST" });
                window.location.href = "/login";
              }}
              className="py-1.5 text-[12px] text-faint hover:text-ink"
            >
              Sign out
            </button>
          ) : (
            <span />
          )}
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
}
