"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Business } from "@/lib/types";
import { BizMark } from "./BizMark";
import { Icon } from "./Icon";
import { squareImage } from "@/lib/squareImage";
import { BUSINESS_TYPES, businessType, commissionSettings, isCommission, typeLabel } from "@/lib/commission";

const COLORS = ["#eb6834", "#2a78d6", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"];

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 32);
const key = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]+/g, "").slice(0, 32);

const toLogo = (file: File) => squareImage(file, 128);

type Draft = Business & { isNew?: boolean };

export function BusinessManager({ initial }: { initial: Business[] }) {
  const [list, setList] = useState(initial);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  const persist = async (next: Business[]) => {
    setSaving(true);
    setError(null);
    const res = await fetch("/api/businesses", { method: "PUT", body: JSON.stringify(next) });
    setSaving(false);
    if (!res.ok) {
      setError(((await res.json()) as { error?: string }).error ?? "Couldn't save");
      return false;
    }
    setList((await res.json()) as Business[]);
    router.refresh();
    return true;
  };

  const startNew = () => {
    const used = new Set(list.map((b) => b.color));
    setDraft({
      isNew: true,
      id: "",
      name: "",
      tagline: "",
      description: "",
      color: COLORS.find((c) => !used.has(c)) ?? COLORS[list.length % COLORS.length],
      sources: {},
    });
  };

  const save = async () => {
    if (!draft || !draft.name.trim()) return setError("Give it a name first");
    const { isNew, ...b } = draft;
    let next: Business[];
    if (isNew) {
      let id = slug(b.name) || "business";
      while (list.some((x) => x.id === id)) id += "2";
      next = [...list, { ...b, id }];
    } else next = list.map((x) => (x.id === b.id ? b : x));
    if (await persist(next)) setDraft(null);
  };

  const remove = async () => {
    if (!draft || draft.isNew) return;
    if (!confirm(`Remove ${draft.name}? Its tasks stay saved and come back if you add a business with the same name.`)) return;
    if (await persist(list.filter((x) => x.id !== draft.id))) setDraft(null);
  };

  return (
    <div className="px-8 pb-10">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((b) => (
          <button key={b.id} onClick={() => { setError(null); setDraft({ ...b, sources: { ...b.sources } }); }} className="card group p-5 text-left transition-shadow hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)]">
            <div className="flex items-center gap-3">
              <BizMark business={b} size={40} />
              <div className="min-w-0">
                <div className="font-serif text-[20px] leading-tight truncate">{b.name}</div>
                {b.tagline && <div className="text-[13px] text-muted truncate">{b.tagline}</div>}
              </div>
              <span className="ml-auto text-[12px] text-faint opacity-0 group-hover:opacity-100">Edit</span>
            </div>
            <p className={`mt-3 line-clamp-3 text-[14px] leading-relaxed ${b.description ? "text-muted" : "text-faint italic"}`}>
              {b.description || "Add a snapshot of what this business does."}
            </p>
            <div className="mt-4 flex flex-wrap gap-1.5 text-[11px] text-muted">
              <span className="rounded-md bg-sidebar px-1.5 py-0.5 text-ink">{typeLabel(businessType(b))}</span>
              {b.sources.stripe?.length ? <span className="rounded-md border border-line px-1.5 py-0.5">Stripe</span> : null}
              {b.sources.shopify?.length ? <span className="rounded-md border border-line px-1.5 py-0.5">Shopify</span> : null}
              {b.sources.gmail ? <span className="rounded-md border border-line px-1.5 py-0.5">Gmail</span> : null}
              {b.sources.mercuryAccountIds?.length ? <span className="rounded-md border border-line px-1.5 py-0.5">Mercury</span> : null}
            </div>
          </button>
        ))}
        <button onClick={startNew} className="flex min-h-[170px] flex-col items-center justify-center gap-2 rounded-[14px] border border-dashed border-line text-muted hover:border-accent hover:text-accent">
          <Icon name="plus" size={20} />
          <span className="text-[14px]">New business</span>
        </button>
      </div>

      {draft && (
        <Editor
          draft={draft}
          setDraft={setDraft}
          onSave={save}
          onDelete={remove}
          onClose={() => setDraft(null)}
          saving={saving}
          error={error}
          canDelete={!draft.isNew && list.length > 1}
        />
      )}
    </div>
  );
}

function Editor({
  draft,
  setDraft,
  onSave,
  onDelete,
  onClose,
  saving,
  error,
  canDelete,
}: {
  draft: Draft;
  setDraft: (d: Draft) => void;
  onSave: () => void;
  onDelete: () => void;
  onClose: () => void;
  saving: boolean;
  error: string | null;
  canDelete: boolean;
}) {
  const file = useRef<HTMLInputElement>(null);
  const [showSources, setShowSources] = useState(!draft.isNew);
  const set = (patch: Partial<Business>) => setDraft({ ...draft, ...patch });
  const src = draft.sources;
  const k = key(draft.name) || "KEY";
  const toggle = (kind: "stripe" | "shopify" | "gmail", on: boolean) => {
    if (kind === "gmail") set({ sources: { ...src, gmail: on ? { account: k } : undefined } });
    else set({ sources: { ...src, [kind]: on ? [k] : [] } });
  };
  const label = "block text-[13px] font-medium text-ink mb-1.5";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="card max-h-[90vh] w-full max-w-xl overflow-y-auto scroll-thin p-6 shadow-2xl">
        <h2 className="font-serif text-[26px] tracking-tight">{draft.isNew ? "Create a business" : `Edit ${draft.name}`}</h2>
        <p className="mt-1 text-[14px] text-muted">The more you describe it, the better Claude can help with it.</p>

        <div className="mt-6 flex items-start gap-4">
          <button
            type="button"
            onClick={() => file.current?.click()}
            className="group relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-line hover:border-accent"
            aria-label="Upload logo"
          >
            {draft.logo || draft.name ? (
              <BizMark business={draft} size={80} />
            ) : (
              <span className="text-[11px] text-faint">Logo</span>
            )}
            <span className="absolute inset-0 hidden items-center justify-center bg-black/40 text-[11px] text-white group-hover:flex">Upload</span>
          </button>
          <input
            ref={file}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) set({ logo: await toLogo(f) });
              e.target.value = "";
            }}
          />
          <div className="flex-1 space-y-3">
            <div>
              <label className={label} htmlFor="biz-name">What&apos;s it called?</label>
              <input id="biz-name" autoFocus className="input" placeholder="e.g. Askaway" value={draft.name} onChange={(e) => set({ name: e.target.value })} />
            </div>
            <div className="flex items-center gap-1.5">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => set({ color: c })}
                  aria-label={`Color ${c}`}
                  className={`h-5 w-5 rounded-full ${draft.color === c ? "ring-2 ring-offset-2 ring-[var(--ink)] ring-offset-[var(--surface)]" : ""}`}
                  style={{ background: c }}
                />
              ))}
              {draft.logo && (
                <button type="button" onClick={() => set({ logo: undefined })} className="ml-auto text-[12px] text-faint hover:text-bad">
                  Remove logo
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="mt-5">
          <label className={label} htmlFor="biz-tag">One-line summary</label>
          <input id="biz-tag" className="input" placeholder="e.g. Live Q&A app for creators" value={draft.tagline} onChange={(e) => set({ tagline: e.target.value })} />
        </div>
        <div className="mt-4">
          <label className={label} htmlFor="biz-desc">What does it do?</label>
          <textarea
            id="biz-desc"
            rows={5}
            className="input resize-y leading-relaxed"
            placeholder="Who it serves, how it makes money, where it is right now, and what you're focused on next."
            value={draft.description ?? ""}
            onChange={(e) => set({ description: e.target.value })}
          />
        </div>

        <div className="mt-4">
          <span className={label}>Business type</span>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {BUSINESS_TYPES.map((t) => {
              const on = businessType(draft) === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => set({ type: t.id, model: undefined, commission: t.id === "commission" ? commissionSettings(draft) : draft.commission })}
                  className={`rounded-xl border px-3 py-2 text-left text-[13px] transition-colors ${on ? "border-accent bg-accent-soft text-ink" : "border-line text-muted hover:text-ink"}`}
                >
                  <div className="font-medium">{t.label}</div>
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 text-[12px] text-faint">{BUSINESS_TYPES.find((t) => t.id === businessType(draft))?.hint}</p>
          {isCommission(draft) && (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="block text-[13px]">
                <span className="mb-1 block text-muted">Commission (% of gross profit)</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  className="input"
                  value={commissionSettings(draft).rate}
                  onChange={(e) => set({ type: "commission", commission: { ...commissionSettings(draft), rate: Number(e.target.value) } })}
                />
              </label>
              <label className="block text-[13px]">
                <span className="mb-1 block text-muted">Typical job cost (% of price)</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  className="input"
                  value={commissionSettings(draft).costPct}
                  onChange={(e) => set({ type: "commission", commission: { ...commissionSettings(draft), costPct: Number(e.target.value) } })}
                />
              </label>
            </div>
          )}
        </div>

        <button type="button" onClick={() => setShowSources(!showSources)} className="mt-5 flex items-center gap-1.5 text-[13px] font-medium text-muted hover:text-ink">
          <span className={`transition-transform ${showSources ? "rotate-90" : ""}`}>›</span> Data sources
        </button>
        {showSources && (
          <div className="mt-3 space-y-3 rounded-xl bg-sidebar/60 p-4 text-[13px]">
            {(["stripe", "shopify"] as const).map((kind) => {
              const on = Boolean(src[kind]?.length);
              const acct = src[kind]?.[0] ?? k;
              return (
                <label key={kind} className="flex items-start gap-2.5">
                  <input type="checkbox" className="mt-0.5 accent-[var(--accent)]" checked={on} onChange={(e) => toggle(kind, e.target.checked)} />
                  <span>
                    <span className="font-medium capitalize">{kind}</span>
                    {on && (
                      <span className="block text-muted">
                        Add {kind === "stripe" ? <code>STRIPE_{acct}_SECRET_KEY</code> : <><code>SHOPIFY_{acct}_STORE</code> and <code>SHOPIFY_{acct}_TOKEN</code></>} on Render.
                      </span>
                    )}
                  </span>
                </label>
              );
            })}
            <label className="flex items-start gap-2.5">
              <input type="checkbox" className="mt-0.5 accent-[var(--accent)]" checked={Boolean(src.gmail)} onChange={(e) => toggle("gmail", e.target.checked)} />
              <span className="flex-1">
                <span className="font-medium">Gmail</span>
                {src.gmail && (
                  <>
                    <span className="block text-muted">Connect the inbox from the Connections page after saving.</span>
                    <input
                      className="input mt-2 !py-1.5"
                      placeholder="Optional filter, e.g. to:hello@askaway.com"
                      value={src.gmail.query ?? ""}
                      onChange={(e) => set({ sources: { ...src, gmail: { ...src.gmail!, query: e.target.value } } })}
                    />
                  </>
                )}
              </span>
            </label>
            <div>
              <span className="font-medium">Mercury account IDs</span>
              <input
                className="input mt-1.5 !py-1.5"
                placeholder="Comma-separated, shown on the Metrics page once Mercury is connected"
                value={(src.mercuryAccountIds ?? []).join(", ")}
                onChange={(e) => set({ sources: { ...src, mercuryAccountIds: e.target.value.split(",").map((x) => x.trim()) } })}
              />
            </div>
          </div>
        )}

        {error && <p className="mt-4 text-[13px] text-bad">{error}</p>}
        <div className="mt-6 flex items-center gap-2">
          {canDelete && (
            <button type="button" onClick={onDelete} className="btn text-bad hover:bg-sidebar">Remove</button>
          )}
          <div className="ml-auto flex gap-2">
            <button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button>
            <button type="button" onClick={onSave} disabled={saving} className="btn btn-primary disabled:opacity-50">
              {saving ? "Saving…" : draft.isNew ? "Create business" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
