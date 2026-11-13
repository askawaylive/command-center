"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Business } from "@/lib/types";
import type { ThreadSummary } from "@/lib/mail";
import { Icon } from "../Icon";
import { BizMark } from "../BizMark";
import { Composer, type Draft } from "./Composer";
import { Reader, type ReaderAction, type Thread } from "./Reader";

const FOLDERS = [
  { id: "inbox", name: "Inbox", icon: "inbox" },
  { id: "starred", name: "Starred", icon: "star" },
  { id: "sent", name: "Sent", icon: "send" },
  { id: "drafts", name: "Drafts", icon: "draft" },
  { id: "all", name: "All Mail", icon: "allMail" },
  { id: "spam", name: "Spam", icon: "spam" },
  { id: "trash", name: "Trash", icon: "trash" },
] as const;
type FolderId = (typeof FOLDERS)[number]["id"];

interface AccountInfo {
  businessId: string;
  manage: boolean;
  email: string;
  inbox: number;
  spam: number;
  drafts: number;
}

const key = (t: { businessId: string; id: string }) => `${t.businessId}:${t.id}`;

function shortDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (d.getFullYear() === now.getFullYear()) return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return d.toLocaleDateString(undefined, { month: "numeric", day: "numeric", year: "2-digit" });
}

/** Which actions take a conversation out of the folder you're looking at. */
const leaves = (folder: FolderId, a: ReaderAction | "read") =>
  (a === "archive" && (folder === "inbox" || folder === "starred")) ||
  (a === "trash" && folder !== "trash") ||
  (a === "spam" && folder !== "spam") ||
  (a === "notspam" && folder === "spam") ||
  (a === "untrash" && folder === "trash") ||
  (a === "unstar" && folder === "starred") ||
  (a === "inbox" && (folder === "spam" || folder === "trash"));

export function MailClient({ businesses }: { businesses: Business[] }) {
  const withGmail = businesses.filter((b) => b.sources.gmail);
  const [accounts, setAccounts] = useState<AccountInfo[] | null>(null);
  const [biz, setBiz] = useState<string>("all");
  const [folder, setFolder] = useState<FolderId>("inbox");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [next, setNext] = useState<Record<string, string> | null>(null);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<{ businessId: string; error: string }[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [thread, setThread] = useState<Thread | null>(null);
  const [threadErr, setThreadErr] = useState<string | null>(null);
  const [compose, setCompose] = useState<Draft | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const reqId = useRef(0);

  const byId = useMemo(() => Object.fromEntries(businesses.map((b) => [b.id, b])), [businesses]);
  const connected = withGmail.filter((b) => accounts?.some((a) => a.businessId === b.id));
  const info = (id: string) => accounts?.find((a) => a.businessId === id);
  const needsReconnect = (accounts ?? []).filter((a) => !a.manage && (biz === "all" || a.businessId === biz));

  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast((t) => (t === m ? null : t)), 3000);
  };

  const loadCounts = useCallback(async () => {
    const j = (await fetch("/api/mail/counts").then((r) => r.json()).catch(() => null)) as { accounts?: AccountInfo[] } | null;
    setAccounts(j?.accounts ?? []);
  }, []);

  const load = useCallback(
    async (more = false) => {
      const id = ++reqId.current;
      setLoading(true);
      const p = new URLSearchParams({ folder, business: biz });
      if (search) p.set("q", search);
      if (more && next) p.set("page", JSON.stringify(next));
      const j = (await fetch(`/api/mail?${p}`).then((r) => r.json()).catch(() => null)) as {
        threads?: ThreadSummary[];
        next?: Record<string, string> | null;
        errors?: { businessId: string; error: string }[];
        error?: string;
      } | null;
      if (id !== reqId.current) return;
      setLoading(false);
      if (!j?.threads) {
        setErrors([{ businessId: "", error: j?.error ?? "Couldn't load mail" }]);
        return;
      }
      setErrors(j.errors ?? []);
      setThreads((cur) => {
        if (!more) return j.threads!;
        const seen = new Set(cur.map(key));
        return [...cur, ...j.threads!.filter((t) => !seen.has(key(t)))].sort((a, b) => b.date.localeCompare(a.date));
      });
      setNext(j.next ?? null);
    },
    [folder, biz, search, next],
  );

  useEffect(() => {
    loadCounts();
  }, [loadCounts]);

  useEffect(() => {
    setSelected(new Set());
    setNext(null);
    load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folder, biz, search]);

  const openThread = async (t: ThreadSummary) => {
    if (folder === "drafts" && t.draftId) {
      const d = (await fetch(`/api/mail/draft?business=${t.businessId}&id=${encodeURIComponent(t.draftId)}`).then((r) => r.json()).catch(() => null)) as
        | (Draft & { error?: string })
        | null;
      if (!d || d.error) return flash(d?.error ?? "Couldn't open draft");
      setCompose({ ...d, business: t.businessId });
      return;
    }
    const k = key(t);
    setOpenKey(k);
    setThread(null);
    setThreadErr(null);
    setThreads((ts) => ts.map((x) => (key(x) === k ? { ...x, unread: false } : x)));
    const j = (await fetch(`/api/mail/thread?business=${t.businessId}&id=${encodeURIComponent(t.id)}`).then((r) => r.json()).catch(() => null)) as
      | (Thread & { error?: string })
      | null;
    if (!j || j.error) return setThreadErr(j?.error ?? "Couldn't open this conversation");
    setThread(j);
    if (t.unread) setTimeout(loadCounts, 500);
  };

  const act = async (items: ThreadSummary[], action: ReaderAction | "read") => {
    if (!items.length) return;
    const ks = new Set(items.map(key));
    const prev = threads;
    if (leaves(folder, action)) {
      setThreads((ts) => ts.filter((t) => !ks.has(key(t))));
      if (openKey && ks.has(openKey)) {
        setOpenKey(null);
        setThread(null);
      }
    } else {
      setThreads((ts) =>
        ts.map((t) =>
          !ks.has(key(t))
            ? t
            : {
                ...t,
                unread: action === "unread" ? true : action === "read" ? false : t.unread,
                starred: action === "star" ? true : action === "unstar" ? false : t.starred,
              },
        ),
      );
      if (action === "unread" && openKey && ks.has(openKey)) {
        setOpenKey(null);
        setThread(null);
      }
    }
    setSelected(new Set());
    const r = await fetch("/api/mail/thread", {
      method: "POST",
      body: JSON.stringify({ action, items: items.map((t) => ({ business: t.businessId, id: t.id })) }),
    }).catch(() => null);
    const j = (await r?.json().catch(() => null)) as { error?: string } | null;
    if (!r?.ok) {
      setThreads(prev);
      flash(j?.error ?? "That didn't work. Try again.");
      return;
    }
    const n = items.length > 1 ? `${items.length} conversations` : "Conversation";
    const msg: Partial<Record<string, string>> = {
      archive: `${n} archived`,
      trash: `${n} moved to Trash`,
      spam: `${n} marked as spam`,
      notspam: `${n} moved to Inbox`,
      untrash: `${n} restored`,
      inbox: `${n} moved to Inbox`,
    };
    if (msg[action]) flash(msg[action]!);
    loadCounts();
  };

  const openSummary = threads.find((t) => key(t) === openKey);
  const selectedItems = threads.filter((t) => selected.has(key(t)));
  const allSelected = threads.length > 0 && selected.size === threads.length;

  // Keyboard: c compose, e archive, # delete, s star, u back, / search.
  const kb = useRef<(e: KeyboardEvent) => void>(() => {});
  kb.current = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement;
    if (e.metaKey || e.ctrlKey || e.altKey || t.closest("input,textarea,select,[contenteditable=true]") || compose) return;
    const target = openSummary ? [openSummary] : selectedItems;
    if (e.key === "c") setCompose(newDraft());
    else if (e.key === "/") (document.getElementById("mail-search") as HTMLInputElement | null)?.focus();
    else if (e.key === "u" || e.key === "Escape") {
      setOpenKey(null);
      setThread(null);
    }
    else if (e.key === "e") act(target, folder === "inbox" || folder === "starred" ? "archive" : "inbox");
    else if (e.key === "#") act(target, "trash");
    else if (e.key === "!") act(target, "spam");
    else if (e.key === "s" && openSummary) act([openSummary], openSummary.starred ? "unstar" : "star");
    else return;
    e.preventDefault();
  };
  useEffect(() => {
    const h = (e: KeyboardEvent) => kb.current(e);
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const newDraft = (): Draft => ({ business: biz !== "all" ? biz : connected[0]?.id ?? withGmail[0]?.id ?? "", to: "", subject: "", body: "" });
  const inboxUnread = (id?: string) => (accounts ?? []).filter((a) => !id || a.businessId === id).reduce((s, a) => s + a.inbox, 0);
  const folderBadge = (f: FolderId) => {
    const pick = (accounts ?? []).filter((a) => biz === "all" || a.businessId === biz);
    if (f === "inbox") return pick.reduce((s, a) => s + a.inbox, 0);
    if (f === "spam") return pick.reduce((s, a) => s + a.spam, 0);
    if (f === "drafts") return pick.reduce((s, a) => s + a.drafts, 0);
    return 0;
  };

  if (accounts && connected.length === 0)
    return (
      <div className="mx-8 mt-6 card p-8 text-center">
        <div className="font-serif text-[22px]">No inboxes connected yet</div>
        <p className="mt-2 text-muted">Connect each business&apos;s Gmail on the Connections page, then come back here.</p>
        <a href="/settings" className="btn btn-primary mt-4 inline-flex">Go to Connections</a>
      </div>
    );

  const rail = (
    <nav className="hidden w-56 shrink-0 flex-col gap-0.5 overflow-y-auto scroll-thin border-r border-line px-3 py-4 md:flex">
      <button onClick={() => setCompose(newDraft())} className="btn btn-primary mb-3 justify-center py-2.5" title="Compose (c)">
        <Icon name="pencil" size={15} /> Compose
      </button>
      {FOLDERS.map((f) => {
        const n = folderBadge(f.id);
        const on = folder === f.id;
        return (
          <button
            key={f.id}
            onClick={() => {
              setFolder(f.id);
              setOpenKey(null);
              setThread(null);
            }}
            className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[14px] ${on ? "bg-sidebar font-medium text-ink" : "text-muted hover:bg-sidebar hover:text-ink"}`}
          >
            <Icon name={f.icon} size={16} />
            {f.name}
            {n > 0 && <span className={`ml-auto text-[12px] ${f.id === "inbox" ? "font-semibold text-accent" : "text-faint"}`}>{n}</span>}
          </button>
        );
      })}
      <div className="mt-5 mb-1 px-2.5 text-[11px] font-medium uppercase tracking-wide text-faint">Inboxes</div>
      {[{ id: "all", name: "All inboxes" } as const, ...withGmail].map((b) => {
        const on = biz === b.id;
        const isConnected = b.id === "all" || connected.some((c) => c.id === b.id);
        const n = isConnected ? inboxUnread(b.id === "all" ? undefined : b.id) : 0;
        return isConnected ? (
          <button
            key={b.id}
            onClick={() => {
              setBiz(b.id);
              setOpenKey(null);
              setThread(null);
            }}
            className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[14px] ${on ? "bg-sidebar font-medium text-ink" : "text-muted hover:bg-sidebar hover:text-ink"}`}
          >
            {"sources" in b ? <BizMark business={b} size={18} /> : <Icon name="allMail" size={16} />}
            <span className="min-w-0 flex-1 truncate">{b.name}</span>
            {n > 0 && <span className="text-[12px] text-faint">{n}</span>}
          </button>
        ) : (
          <a key={b.id} href="/settings" className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[14px] text-faint hover:bg-sidebar" title="Connect this inbox">
            {"sources" in b && <BizMark business={b} size={18} />}
            <span className="min-w-0 flex-1 truncate">{b.name}</span>
            <span className="text-[11px]">Connect</span>
          </a>
        );
      })}
    </nav>
  );

  const toolbarBtn = "inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-sidebar hover:text-ink";

  const list = (
    <section className={`flex min-h-0 min-w-0 flex-col border-r border-line ${openKey ? "hidden w-[400px] shrink-0 xl:flex" : "flex-1"}`}>
      <div className="flex shrink-0 items-center gap-1 border-b border-line px-3 py-2">
        <input
          type="checkbox"
          aria-label="Select all"
          checked={allSelected}
          onChange={() => setSelected(allSelected ? new Set() : new Set(threads.map(key)))}
          className="mx-1.5 h-4 w-4 accent-[var(--accent)]"
        />
        {selected.size > 0 ? (
          <>
            {folder === "inbox" || folder === "starred" ? (
              <button onClick={() => act(selectedItems, "archive")} className={toolbarBtn} title="Archive">
                <Icon name="archive" size={16} />
              </button>
            ) : (
              <button onClick={() => act(selectedItems, folder === "spam" ? "notspam" : folder === "trash" ? "untrash" : "inbox")} className={toolbarBtn} title="Move to Inbox">
                <Icon name="inbox" size={16} />
              </button>
            )}
            {folder !== "spam" && folder !== "trash" && (
              <button onClick={() => act(selectedItems, "spam")} className={toolbarBtn} title="Report spam">
                <Icon name="spam" size={16} />
              </button>
            )}
            {folder !== "trash" && (
              <button onClick={() => act(selectedItems, "trash")} className={toolbarBtn} title="Delete">
                <Icon name="trash" size={16} />
              </button>
            )}
            <button onClick={() => act(selectedItems, "read")} className={toolbarBtn} title="Mark read">
              <Icon name="mailOpen" size={16} />
            </button>
            <button onClick={() => act(selectedItems, "unread")} className={toolbarBtn} title="Mark unread">
              <Icon name="mail" size={16} />
            </button>
            <span className="ml-1 text-[13px] text-muted">{selected.size} selected</span>
          </>
        ) : (
          <button onClick={() => (load(false), loadCounts())} className={toolbarBtn} title="Refresh">
            <Icon name="refresh" size={16} />
          </button>
        )}
        <form
          className="ml-auto flex min-w-0 items-center gap-1.5 rounded-lg border border-line px-2.5 py-1"
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(query.trim());
          }}
        >
          <Icon name="search" size={14} className="shrink-0 text-faint" />
          <input
            id="mail-search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (!e.target.value) setSearch("");
            }}
            placeholder="Search mail"
            className="w-36 min-w-0 bg-transparent text-[13px] outline-none placeholder:text-faint lg:w-48"
          />
        </form>
      </div>
      {needsReconnect.length > 0 && (
        <div className="shrink-0 border-b border-line bg-sidebar px-4 py-2 text-[13px] text-muted">
          To archive, delete, send and use drafts, click <b className="text-ink">Reconnect</b> once for{" "}
          {needsReconnect.map((a) => byId[a.businessId]?.name).join(", ")} on the{" "}
          <a href="/settings" className="text-accent underline">
            Connections
          </a>{" "}
          page.
        </div>
      )}
      {errors.length > 0 && (
        <div className="shrink-0 border-b border-line px-4 py-2 text-[13px] text-bad">
          {errors.map((e) => `${byId[e.businessId]?.name ?? "Mail"}: ${e.error}`).join(" · ")}
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto scroll-thin">
        {loading && threads.length === 0 && <div className="p-6 text-muted">Loading…</div>}
        {!loading && threads.length === 0 && (
          <div className="p-10 text-center text-muted">{search ? `Nothing matches “${search}”.` : folder === "inbox" ? "Inbox zero. Nice." : "Nothing here."}</div>
        )}
        {threads.map((t) => {
          const k = key(t);
          const on = openKey === k;
          const b = byId[t.businessId];
          return (
            <div
              key={k}
              onClick={() => openThread(t)}
              className={`group flex cursor-pointer items-center gap-2 border-b border-line px-3 py-2.5 text-[14px] ${on ? "bg-sidebar" : selected.has(k) ? "bg-[color-mix(in_srgb,var(--accent)_8%,transparent)]" : "hover:bg-bg"}`}
            >
              <input
                type="checkbox"
                aria-label="Select"
                checked={selected.has(k)}
                onClick={(e) => e.stopPropagation()}
                onChange={() =>
                  setSelected((s) => {
                    const n = new Set(s);
                    if (n.has(k)) n.delete(k);
                    else n.add(k);
                    return n;
                  })
                }
                className="mx-1.5 h-4 w-4 shrink-0 accent-[var(--accent)]"
              />
              {folder !== "drafts" && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    act([t], t.starred ? "unstar" : "star");
                  }}
                  className={`shrink-0 ${t.starred ? "text-[#e3a008]" : "text-faint opacity-60 hover:opacity-100"}`}
                  title={t.starred ? "Unstar" : "Star"}
                >
                  <Icon name="star" size={16} className={t.starred ? "fill-current" : ""} />
                </button>
              )}
              {biz === "all" && b && (
                <span className="shrink-0" title={b.name}>
                  <BizMark business={b} size={18} />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className={`truncate ${t.unread ? "font-semibold text-ink" : "text-ink/80"}`}>
                    {folder === "drafts" ? <span className="text-bad">Draft</span> : t.from}
                    {t.count > 1 && <span className="ml-1 text-[12px] font-normal text-faint">{t.count}</span>}
                  </span>
                  <span className={`ml-auto shrink-0 text-[12px] ${t.unread ? "font-semibold text-ink" : "text-faint"}`}>{shortDate(t.date)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="min-w-0 flex-1 truncate text-[13px]">
                    <span className={t.unread ? "font-medium text-ink" : "text-ink/80"}>{t.subject}</span>
                    <span className="text-muted"> — {t.snippet}</span>
                  </div>
                  {t.hasAttachment && <Icon name="clip" size={13} className="shrink-0 text-faint" />}
                </div>
              </div>
              {folder !== "drafts" && (
                <div className="hidden shrink-0 items-center group-hover:flex" onClick={(e) => e.stopPropagation()}>
                  {(folder === "inbox" || folder === "starred") && (
                    <button onClick={() => act([t], "archive")} className={toolbarBtn} title="Archive">
                      <Icon name="archive" size={15} />
                    </button>
                  )}
                  {folder !== "trash" && (
                    <button onClick={() => act([t], "trash")} className={toolbarBtn} title="Delete">
                      <Icon name="trash" size={15} />
                    </button>
                  )}
                  <button onClick={() => act([t], t.unread ? "read" : "unread")} className={toolbarBtn} title={t.unread ? "Mark read" : "Mark unread"}>
                    <Icon name={t.unread ? "mailOpen" : "mail"} size={15} />
                  </button>
                </div>
              )}
            </div>
          );
        })}
        {next && (
          <div className="p-4 text-center">
            <button onClick={() => load(true)} disabled={loading} className="btn btn-ghost border border-line">
              {loading ? "Loading…" : "Load more"}
            </button>
          </div>
        )}
      </div>
    </section>
  );

  return (
    <div className="relative flex h-full min-h-0">
      {rail}
      {list}
      {openKey && (
        <section className="min-h-0 min-w-0 flex-1">
          {thread ? (
            <Reader
              thread={thread}
              folder={folder}
              business={byId[thread.businessId]}
              accounts={connected}
              myEmail={info(thread.businessId)?.email ?? ""}
              starred={openSummary?.starred ?? false}
              onAction={(a) => openSummary && act([openSummary], a)}
              onBack={() => (setOpenKey(null), setThread(null))}
              onSent={(m) => {
                flash(m);
                if (openSummary) openThread(openSummary);
              }}
            />
          ) : (
            <div className="p-8 text-muted">{threadErr ?? "Loading…"}</div>
          )}
        </section>
      )}
      {compose && (
        <Composer
          key={compose.draftId ?? "new"}
          initial={compose}
          accounts={connected}
          onClose={() => {
            setCompose(null);
            if (folder === "drafts") load(false);
            loadCounts();
          }}
          onSent={(m) => {
            setCompose(null);
            flash(m);
            if (folder === "drafts" || folder === "sent") load(false);
            loadCounts();
          }}
        />
      )}
      {toast && (
        <div className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-ink px-4 py-2 text-[14px] text-bg shadow-lg">{toast}</div>
      )}
    </div>
  );
}
