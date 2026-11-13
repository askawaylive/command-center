import "server-only";
import { randomUUID } from "node:crypto";
import { deleteDoc, getDoc, listDocFields, putDocs } from "./store";

interface StoredPhoto {
  id: string;
  src: string; // data: URL, resized in the browser before upload
  createdAt: string;
}

/** What pages get: a small URL instead of the image itself, so pages stay light and the browser caches images. */
export interface Photo {
  id: string;
  src: string;
  createdAt: string;
}

const COLL = "photos";
const SRC_RE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
export const MAX_PHOTO_CHARS = 1_500_000;

const toPublic = (p: { id: string; createdAt: string }): Photo => ({ id: p.id, createdAt: p.createdAt, src: `/api/photos/${p.id}/image` });

export async function listPhotos(): Promise<Photo[]> {
  const rows = await listDocFields<{ id: string; createdAt: string }>(COLL, ["id", "createdAt"]);
  return rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map(toPublic);
}

export async function photoImage(id: string): Promise<{ type: string; data: Buffer } | undefined> {
  const p = await getDoc<StoredPhoto>(COLL, id);
  const m = p?.src.match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/);
  return m ? { type: m[1], data: Buffer.from(m[2], "base64") } : undefined;
}

export async function addPhoto(src: unknown): Promise<Photo | undefined> {
  if (typeof src !== "string" || src.length > MAX_PHOTO_CHARS || !SRC_RE.test(src)) return undefined;
  const p: StoredPhoto = { id: randomUUID(), src, createdAt: new Date().toISOString() };
  await putDocs(COLL, [p]);
  return toPublic(p);
}

export async function deletePhoto(id: string) {
  await deleteDoc(COLL, id);
}
