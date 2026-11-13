import "server-only";
import { randomUUID } from "node:crypto";
import { deleteDoc, listDocs, putDocs } from "./store";

export interface Photo {
  id: string;
  src: string; // data: URL, resized in the browser before upload
  createdAt: string;
}

const COLL = "photos";
const SRC_RE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
export const MAX_PHOTO_CHARS = 1_500_000;

export async function listPhotos(): Promise<Photo[]> {
  return ((await listDocs<Photo>(COLL)) ?? []).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function addPhoto(src: unknown): Promise<Photo | undefined> {
  if (typeof src !== "string" || src.length > MAX_PHOTO_CHARS || !SRC_RE.test(src)) return undefined;
  const p: Photo = { id: randomUUID(), src, createdAt: new Date().toISOString() };
  await putDocs(COLL, [p]);
  return p;
}

export async function deletePhoto(id: string) {
  await deleteDoc(COLL, id);
}
