import "server-only";
import { randomUUID } from "node:crypto";
import type { Contact } from "./types";
import { deleteDoc, listDocs, putDocs } from "./store";

const COLL = "contacts";
const PHOTO_RE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) || undefined : undefined);

/** Keep only known fields, trimmed and size-limited. */
function clean(input: Partial<Contact>): Partial<Contact> {
  const out: Partial<Contact> = {};
  if ("name" in input) out.name = str(input.name, 80) ?? "Unnamed";
  if ("businessId" in input) out.businessId = str(input.businessId, 32);
  if ("role" in input) out.role = str(input.role, 80);
  if ("company" in input) out.company = str(input.company, 80);
  if ("email" in input) out.email = str(input.email, 120);
  if ("phone" in input) out.phone = str(input.phone, 40);
  if ("notes" in input) out.notes = str(input.notes, 5000);
  if ("photo" in input)
    out.photo = typeof input.photo === "string" && PHOTO_RE.test(input.photo) && input.photo.length < 200_000 ? input.photo : undefined;
  return out;
}

export async function listContacts(): Promise<Contact[]> {
  const list = (await listDocs<Contact>(COLL)) ?? [];
  return list.sort((a, b) => a.name.localeCompare(b.name));
}

export async function createContact(input: Partial<Contact>): Promise<Contact> {
  const c: Contact = { name: "Unnamed", ...clean(input), id: randomUUID(), createdAt: new Date().toISOString() };
  await putDocs(COLL, [c]);
  return c;
}

export async function updateContact(id: string, patch: Partial<Contact>): Promise<Contact | undefined> {
  const c = (await listDocs<Contact>(COLL))?.find((x) => x.id === id);
  if (!c) return undefined;
  const next = { ...c, ...clean(patch), id };
  await putDocs(COLL, [next]);
  return next;
}

export async function deleteContact(id: string) {
  await deleteDoc(COLL, id);
}
