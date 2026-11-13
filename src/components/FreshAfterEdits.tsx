"use client";
import { Fragment, useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";

let patched = false;
let editedAt = 0;
let onEdit: (autosave?: boolean) => void = () => {};

/**
 * Pages you've visited are kept in the browser so switching back is instant. When you change
 * something (any POST/PUT/PATCH/DELETE to the app's API), the saved copies are dropped, and if you
 * land on one before that finishes, the page reloads its data and redraws once it's fresh.
 */
export function FreshPages({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [version, setVersion] = useState(0);
  const [pending, startTransition] = useTransition();
  const remountWhenDone = useRef(false);

  useEffect(() => {
    onEdit = (autosave?: boolean) => {
      editedAt = Date.now();
      // Notes and mind maps save as you type; don't re-render the page on every keystroke.
      if (autosave) return;
      clearTimeout(timer.current);
      // Refresh in place (keeps what's on screen) so other pages' saved copies are dropped.
      timer.current = setTimeout(() => router.refresh(), 400);
    };
    if (patched) return;
    patched = true;
    const orig = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const res = await orig(input, init);
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
      if (method !== "GET" && res.ok && /^(\/|https?:\/\/[^/]+\/)api\//.test(url) && !/\/api\/(prefs|mail|agent)/.test(url))
        onEdit(/\/api\/(notes|mindmaps)\//.test(url));
      return res;
    };
  }, [router]);

  // Landed on a page shortly after an edit: fetch it fresh, then redraw it with the new data.
  useEffect(() => {
    if (Date.now() - editedAt > 15_000) return;
    remountWhenDone.current = true;
    startTransition(() => router.refresh());
  }, [path, router]);

  useEffect(() => {
    if (!pending && remountWhenDone.current) {
      remountWhenDone.current = false;
      setVersion((v) => v + 1);
    }
  }, [pending]);

  return <Fragment key={version}>{children}</Fragment>;
}
