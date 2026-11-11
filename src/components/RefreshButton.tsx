"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "./Icon";

export function RefreshButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="btn btn-ghost border border-line"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch("/api/refresh", { method: "POST" });
        router.refresh();
        setTimeout(() => setBusy(false), 600);
      }}
    >
      <Icon name="refresh" size={14} className={busy ? "animate-spin" : ""} /> Refresh
    </button>
  );
}
