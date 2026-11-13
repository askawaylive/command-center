"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Business, Contact } from "@/lib/types";
import { squareImage } from "@/lib/squareImage";
import { BizMark } from "./BizMark";
import { Icon } from "./Icon";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

export function Avatar({ contact, size = 40, color }: { contact: Pick<Contact, "name" | "photo">; size?: number; color?: string }) {
  if (contact.photo)
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={contact.photo} alt="" className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />;
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-full font-medium"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38), background: color ? `${color}26` : "var(--sidebar)", color: color ?? "var(--muted)" }}
    >
      {initials(contact.name) || "?"}
    </span>
  );
}

type Draft = Partial<Contact> & { isNew?: boolean };

function Editor({
  draft,
  businesses,
  onSave,
  onDelete,
  onClose,
}: {
  draft: Draft;
  businesses: Business[];
  onSave: (c: Draft) => Promise<void>;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [d, setD] = useState<Draft>(draft);
  const [saving, setSaving] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => setD(draft), [draft]);
  const set = (k: keyof Contact) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setD({ ...d, [k]: e.target.value });
  const biz = businesses.find((b) => b.id === d.businessId);
  const dirty = JSON.stringify(d) !== JSON.stringify(draft);

  const field = (label: string, k: keyof Contact, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="block">
      <span className="mb-1 block text-[12px] text-muted">{label}</span>
      <input className="input" value={(d[k] as string) ?? ""} onChange={set(k)} {...props} />
    </label>
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <span className="text-[13px] text-muted">{d.isNew ? "New contact" : "Contact"}</span>
        {!d.isNew && (
          <button onClick={onDelete} aria-label="Delete contact" className="ml-auto rounded-md p-1.5 text-faint hover:bg-sidebar hover:text-bad">
            <Icon name="trash" size={15} />
          </button>
        )}
        <div className={`${d.isNew ? "ml-auto " : ""}flex items-center gap-1`}>
        <button
          className="btn btn-primary !py-1 disabled:opacity-50"
          disabled={saving || !d.name?.trim() || (!dirty && !d.isNew)}
          onClick={async () => {
            setSaving(true);
            await onSave(d);
            setSaving(false);
          }}
        >
          {saving ? "Saving…" : d.isNew ? "Add contact" : dirty ? "Save" : "Saved"}
        </button>
          <button onClick={onClose} aria-label="Close" className="rounded-md p-1.5 text-faint hover:bg-sidebar hover:text-ink">
            <Icon name="x" size={15} />
          </button>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto scroll-thin p-4 pb-24">
        <div className="flex flex-col items-center gap-2 pt-2">
          <button onClick={() => file.current?.click()} className="group relative rounded-full" aria-label="Upload profile picture">
            <Avatar contact={{ name: d.name ?? "", photo: d.photo }} size={88} color={biz?.color} />
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/45 text-white opacity-0 transition-opacity group-hover:opacity-100">
              <Icon name="camera" size={22} />
            </span>
          </button>
          <div className="flex gap-3 text-[12px]">
            <button onClick={() => file.current?.click()} className="text-accent hover:underline">{d.photo ? "Change photo" : "Add photo"}</button>
            {d.photo && <button onClick={() => setD({ ...d, photo: undefined })} className="text-faint hover:text-bad">Remove</button>}
          </div>
          <input
            ref={file}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) setD({ ...d, photo: await squareImage(f, 160) });
            }}
          />
        </div>

        {field("Name", "name", { autoFocus: d.isNew, placeholder: "Full name" })}
        <label className="block">
          <span className="mb-1 block text-[12px] text-muted">Business</span>
          <div className="flex items-center gap-2">
            {biz && <BizMark business={biz} size={28} />}
            <select className="input" value={d.businessId ?? ""} onChange={set("businessId")}>
              <option value="">Not tied to a business</option>
              {businesses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
        </label>
        <div className="grid grid-cols-2 gap-3">
          {field("Role", "role", { placeholder: "Supplier, investor…" })}
          {field("Company", "company")}
        </div>
        {field("Email", "email", { type: "email", placeholder: "name@example.com" })}
        {field("Phone", "phone", { type: "tel" })}
        <label className="block">
          <span className="mb-1 block text-[12px] text-muted">Notes</span>
          <textarea className="input resize-y leading-relaxed" rows={5} value={d.notes ?? ""} onChange={set("notes")} placeholder="How you met, what they're working on…" />
        </label>
        {!d.isNew && (d.email || d.phone) && (
          <div className="flex gap-2">
            {d.email && <a href={`mailto:${d.email}`} className="btn border border-line"><Icon name="mail" size={14} /> Email</a>}
            {d.phone && <a href={`tel:${d.phone}`} className="btn border border-line">Call</a>}
          </div>
        )}
      </div>

    </div>
  );
}

export function ContactBook({ initial, businesses }: { initial: Contact[]; businesses: Business[] }) {
  const [contacts, setContacts] = useState(initial);
  const [q, setQ] = useState("");
  const [biz, setBiz] = useState("all");
  const [draft, setDraft] = useState<Draft | null>(null);
  const byId = useMemo(() => Object.fromEntries(businesses.map((b) => [b.id, b])), [businesses]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDraft(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const needle = q.trim().toLowerCase();
  const visible = contacts
    .filter((c) => biz === "all" || (biz === "none" ? !c.businessId : c.businessId === biz))
    .filter((c) => !needle || [c.name, c.company, c.role, c.email, c.phone].some((v) => v?.toLowerCase().includes(needle)))
    .sort((a, b) => a.name.localeCompare(b.name));

  const save = async (d: Draft) => {
    const { isNew, ...body } = d;
    if (isNew) {
      const r = await fetch("/api/contacts", { method: "POST", body: JSON.stringify(body) });
      const c = (await r.json()) as Contact;
      setContacts((cs) => [...cs, c]);
      setDraft(c);
    } else {
      const patch = { ...body, photo: body.photo ?? "", businessId: body.businessId ?? "" };
      const r = await fetch(`/api/contacts/${d.id}`, { method: "PATCH", body: JSON.stringify(patch) });
      if (r.ok) {
        const c = (await r.json()) as Contact;
        setContacts((cs) => cs.map((x) => (x.id === c.id ? c : x)));
        setDraft(c);
      }
    }
  };

  const chip = (active: boolean) =>
    `inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] border transition-colors ${active ? "bg-ink text-bg border-ink" : "border-line text-muted hover:text-ink"}`;

  return (
    <div className="flex h-full">
      <div className="min-w-0 flex-1 overflow-y-auto scroll-thin px-8 pt-8 pb-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[32px] leading-tight">Contacts</h1>
            <p className="mt-1 text-[15px] text-muted">Everyone you work with, by business.</p>
          </div>
          <button className="btn btn-primary" onClick={() => setDraft({ isNew: true, name: "", businessId: biz !== "all" && biz !== "none" ? biz : undefined })}>
            <Icon name="plus" size={14} /> New contact
          </button>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <div className="relative mr-2 w-full sm:w-64">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint"><Icon name="search" size={14} /></span>
            <input className="input !rounded-full !py-1.5 !pl-8" placeholder="Search contacts" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <button className={chip(biz === "all")} onClick={() => setBiz("all")}>All</button>
          {businesses.map((b) => (
            <button key={b.id} className={`${chip(biz === b.id)} !pl-1.5`} onClick={() => setBiz(b.id)}>
              <BizMark business={b} size={18} /> {b.name}
            </button>
          ))}
          <button className={chip(biz === "none")} onClick={() => setBiz("none")}>Other</button>
        </div>

        {contacts.length === 0 ? (
          <div className="mt-16 text-center">
            <span className="text-faint"><Icon name="users" size={30} /></span>
            <p className="mt-3 text-muted">No contacts yet. Add the people you work with and tag them to a business.</p>
          </div>
        ) : visible.length === 0 ? (
          <p className="mt-10 text-center text-muted">No contacts match.</p>
        ) : (
          <div className="mt-6 grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
            {visible.map((c) => {
              const b = c.businessId ? byId[c.businessId] : undefined;
              return (
                <button
                  key={c.id}
                  onClick={() => setDraft(c)}
                  className={`card flex items-center gap-3 p-3 text-left transition-shadow hover:shadow-[0_2px_10px_rgba(0,0,0,0.06)] ${draft?.id === c.id ? "!border-accent ring-1 ring-accent" : ""}`}
                >
                  <Avatar contact={c} size={44} color={b?.color} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-medium">{c.name}</div>
                    <div className="truncate text-[12px] text-muted">{[c.role, c.company].filter(Boolean).join(" · ") || c.email || c.phone || " "}</div>
                  </div>
                  {b && <span title={b.name}><BizMark business={b} size={20} /></span>}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {draft && (
        <aside className="fixed inset-y-0 right-0 z-30 flex w-[360px] max-w-full flex-col border-l border-line bg-surface shadow-2xl lg:static lg:shadow-none">
          <Editor
            key={draft.id ?? "new"}
            draft={draft}
            businesses={businesses}
            onSave={save}
            onDelete={async () => {
              if (!draft.id || !confirm(`Delete ${draft.name}?`)) return;
              setContacts((cs) => cs.filter((x) => x.id !== draft.id));
              setDraft(null);
              await fetch(`/api/contacts/${draft.id}`, { method: "DELETE" });
            }}
            onClose={() => setDraft(null)}
          />
        </aside>
      )}
    </div>
  );
}
