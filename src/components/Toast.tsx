"use client";
import { useEffect, useState } from "react";

/** Show a short message at the bottom of the screen from anywhere in the app. */
export function toast(message: string) {
  window.dispatchEvent(new CustomEvent("cc-toast", { detail: message }));
}

export function Toaster() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const on = (e: Event) => {
      setMsg((e as CustomEvent<string>).detail);
      clearTimeout(timer);
      timer = setTimeout(() => setMsg(null), 4000);
    };
    window.addEventListener("cc-toast", on);
    return () => window.removeEventListener("cc-toast", on);
  }, []);
  if (!msg) return null;
  return (
    <div role="status" className="fixed bottom-6 left-1/2 z-[60] max-w-[90vw] -translate-x-1/2 rounded-xl bg-ink px-4 py-2.5 text-[13px] text-bg shadow-xl">
      {msg}
    </div>
  );
}
