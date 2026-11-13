"use client";
import { useEffect, useState } from "react";
import { Icon } from "./Icon";

type Theme = "light" | "dark";

function current(): Theme {
  const set = document.documentElement.dataset.theme;
  if (set === "light" || set === "dark") return set;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Light/dark switch. Follows the system until you pick one, then remembers it on this device. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);
  useEffect(() => setTheme(current()), []);

  const pick = (t: Theme) => {
    document.documentElement.dataset.theme = t;
    try {
      localStorage.setItem("theme", t);
    } catch {}
    setTheme(t);
  };

  const opt = (t: Theme, icon: string, label: string) => (
    <button
      onClick={() => pick(t)}
      aria-label={`${label} mode`}
      aria-pressed={theme === t}
      title={`${label} mode`}
      className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors ${
        theme === t ? "bg-surface text-ink shadow-[0_1px_2px_rgba(0,0,0,0.08)]" : "text-faint hover:text-ink"
      }`}
    >
      <Icon name={icon} size={15} />
    </button>
  );

  return (
    <div className="flex items-center gap-0.5 rounded-full border border-line bg-sidebar p-0.5">
      {opt("light", "sun", "Light")}
      {opt("dark", "moon", "Dark")}
    </div>
  );
}
