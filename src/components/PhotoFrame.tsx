"use client";
import { useEffect, useRef, useState } from "react";
import { fitImage } from "@/lib/squareImage";
import { Icon } from "./Icon";

export interface Photo {
  id: string;
  src: string;
  createdAt: string;
}

const INTERVALS = [
  { s: 5, label: "Every 5 sec" },
  { s: 10, label: "Every 10 sec" },
  { s: 30, label: "Every 30 sec" },
  { s: 60, label: "Every minute" },
  { s: 300, label: "Every 5 min" },
  { s: 900, label: "Every 15 min" },
  { s: 3600, label: "Every hour" },
  { s: 0, label: "Don't rotate" },
];

/** Family photo slideshow: crossfades to the next picture on a timer you choose. */
export function PhotoFrame({ initial, initialInterval, header }: { initial: Photo[]; initialInterval: number; header: React.ReactNode }) {
  const [photos, setPhotos] = useState(initial);
  const [i, setI] = useState(0);
  const [interval, setIntervalSec] = useState(initialInterval);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [menu, setMenu] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const n = photos.length;
  const idx = n ? i % n : 0;

  useEffect(() => {
    if (!interval || n < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % n), interval * 1000);
    return () => clearInterval(t);
  }, [interval, n, idx]);

  const upload = async (files: FileList) => {
    setBusy(true);
    setError("");
    for (const f of Array.from(files)) {
      try {
        const src = await fitImage(f, 1600);
        const r = await fetch("/api/photos", { method: "POST", body: JSON.stringify({ src }) });
        if (!r.ok) throw new Error(((await r.json()) as { error?: string }).error);
        const p = (await r.json()) as Photo;
        setPhotos((ps) => {
          setI(ps.length);
          return [...ps, p];
        });
      } catch (e) {
        setError(e instanceof Error && e.message ? e.message : `Couldn't add ${f.name}.`);
      }
    }
    setBusy(false);
  };

  const removeCurrent = async () => {
    const p = photos[idx];
    if (!p || !confirm("Remove this photo?")) return;
    setPhotos((ps) => ps.filter((x) => x.id !== p.id));
    await fetch(`/api/photos/${p.id}`, { method: "DELETE" });
  };

  const setSpeed = (s: number) => {
    setIntervalSec(s);
    setMenu(false);
    fetch("/api/prefs/photos:interval", { method: "PUT", body: JSON.stringify({ value: s }) });
  };

  const iconBtn = "rounded-md p-1 text-muted hover:bg-sidebar hover:text-ink";

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-1 pb-2">
        {header}
        <div className="relative">
          <button onClick={() => setMenu((m) => !m)} className={`${iconBtn} flex items-center gap-1 text-[12px]`} aria-label="Slideshow timer">
            <Icon name="clock" size={13} /> {INTERVALS.find((x) => x.s === interval)?.label ?? `Every ${interval}s`}
          </button>
          {menu && (
            <div className="absolute right-0 top-full z-10 mt-1 w-40 rounded-lg border border-line bg-surface p-1 shadow-lg">
              {INTERVALS.map((x) => (
                <button
                  key={x.s}
                  onClick={() => setSpeed(x.s)}
                  className={`block w-full rounded-md px-2.5 py-1.5 text-left text-[13px] hover:bg-sidebar ${x.s === interval ? "text-accent" : ""}`}
                >
                  {x.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <button onClick={() => file.current?.click()} className={iconBtn} aria-label="Add photos" title="Add photos">
          <Icon name="plus" size={15} />
        </button>
        {n > 0 && (
          <button onClick={removeCurrent} className={`${iconBtn} hover:!text-bad`} aria-label="Remove this photo" title="Remove this photo">
            <Icon name="trash" size={14} />
          </button>
        )}
        <input
          ref={file}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) upload(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      <div className="group relative min-h-0 flex-1 overflow-hidden rounded-xl bg-sidebar">
        {n === 0 ? (
          <button onClick={() => file.current?.click()} className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted hover:text-ink">
            <Icon name="camera" size={26} />
            <span className="text-[13px]">{busy ? "Adding…" : "Add family photos"}</span>
          </button>
        ) : (
          <>
            {photos.map((p, k) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={p.id}
                src={p.src}
                alt=""
                className="absolute inset-0 h-full w-full object-cover transition-opacity duration-1000"
                style={{ opacity: k === idx ? 1 : 0 }}
              />
            ))}
            {n > 1 && (
              <>
                <button
                  onClick={() => setI((idx - 1 + n) % n)}
                  aria-label="Previous photo"
                  className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/35 p-1.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <Icon name="chevronLeft" size={16} />
                </button>
                <button
                  onClick={() => setI((idx + 1) % n)}
                  aria-label="Next photo"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/35 p-1.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <Icon name="chevronRight" size={16} />
                </button>
                <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1">
                  {photos.map((p, k) => (
                    <span key={p.id} className={`h-1.5 w-1.5 rounded-full ${k === idx ? "bg-white" : "bg-white/45"}`} />
                  ))}
                </div>
              </>
            )}
            {busy && <div className="absolute right-2 top-2 rounded-md bg-black/45 px-2 py-0.5 text-[12px] text-white">Adding…</div>}
          </>
        )}
      </div>
      {error && <p className="pt-1.5 text-[12px] text-bad">{error}</p>}
    </div>
  );
}
