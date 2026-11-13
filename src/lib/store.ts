import "server-only";
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";

/**
 * Tiny key/value + document store.
 * Hosted (DATABASE_URL set): Postgres. Local: data/db.json.
 */
interface FileDb {
  docs: Record<string, Record<string, unknown>>; // collection -> id -> doc
  kv: Record<string, unknown>;
}

const FILE = path.join(process.cwd(), "data", "db.json");
let pool: Pool | undefined;
let ready: Promise<void> | undefined;

function needsTls(url: string) {
  const host = new URL(url).hostname;
  return host.includes(".") && host !== "127.0.0.1" && !/sslmode=disable/.test(url);
}

function pg() {
  if (!process.env.DATABASE_URL) return undefined;
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      // Render's internal URL (host like dpg-xxx-a) is private network, no TLS; external hosts need TLS.
      ssl: needsTls(process.env.DATABASE_URL) ? { rejectUnauthorized: false } : undefined,
      max: 5,
    });
    ready = pool
      .query(
        `create table if not exists docs (collection text not null, id text not null, data jsonb not null, primary key (collection, id));
         create table if not exists kv (key text primary key, value jsonb not null);`,
      )
      .then(() => undefined);
  }
  return pool;
}

async function db() {
  const p = pg();
  if (p) await ready;
  return p;
}

function readFile(): FileDb {
  if (!fs.existsSync(FILE)) return { docs: {}, kv: {} };
  const raw = JSON.parse(fs.readFileSync(FILE, "utf8"));
  // migrate the first local format ({ tasks: [...] })
  if (Array.isArray(raw.tasks)) {
    return { docs: { tasks: Object.fromEntries(raw.tasks.map((t: { id: string }) => [t.id, t])) }, kv: raw.kv ?? {} };
  }
  return { docs: raw.docs ?? {}, kv: raw.kv ?? {} };
}

function writeFile(d: FileDb) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE + ".tmp", JSON.stringify(d, null, 2));
  fs.renameSync(FILE + ".tmp", FILE);
}

export async function listDocs<T>(collection: string): Promise<T[] | undefined> {
  const p = await db();
  if (p) {
    const { rows } = await p.query("select data from docs where collection = $1", [collection]);
    const has = await p.query("select 1 from kv where key = $1", [`seeded:${collection}`]);
    return has.rowCount ? rows.map((r) => r.data as T) : undefined;
  }
  const f = readFile();
  return f.docs[collection] ? (Object.values(f.docs[collection]) as T[]) : undefined;
}

export async function putDocs(collection: string, docs: { id: string }[]) {
  const p = await db();
  if (p) {
    for (const d of docs)
      await p.query(
        "insert into docs (collection, id, data) values ($1, $2, $3) on conflict (collection, id) do update set data = excluded.data",
        [collection, d.id, d],
      );
    await p.query("insert into kv (key, value) values ($1, 'true') on conflict do nothing", [`seeded:${collection}`]);
    return;
  }
  const f = readFile();
  f.docs[collection] ??= {};
  for (const d of docs) f.docs[collection][d.id] = d;
  writeFile(f);
}

export async function deleteDoc(collection: string, id: string) {
  const p = await db();
  if (p) {
    await p.query("delete from docs where collection = $1 and id = $2", [collection, id]);
    return;
  }
  const f = readFile();
  delete f.docs[collection]?.[id];
  writeFile(f);
}

export async function getKV<T>(key: string): Promise<T | undefined> {
  const p = await db();
  if (p) {
    const { rows } = await p.query("select value from kv where key = $1", [key]);
    return rows[0]?.value as T | undefined;
  }
  return readFile().kv[key] as T | undefined;
}

export async function setKV(key: string, value: unknown) {
  const p = await db();
  if (p) {
    await p.query("insert into kv (key, value) values ($1, $2) on conflict (key) do update set value = excluded.value", [key, JSON.stringify(value)]);
    return;
  }
  const f = readFile();
  f.kv[key] = value;
  writeFile(f);
}

/** All key/value pairs whose key starts with `prefix`. */
export async function listKV<T>(prefix: string): Promise<{ key: string; value: T }[]> {
  const p = await db();
  if (p) {
    const { rows } = await p.query("select key, value from kv where starts_with(key, $1)", [prefix]);
    return rows.map((r) => ({ key: r.key as string, value: r.value as T }));
  }
  return Object.entries(readFile().kv)
    .filter(([k]) => k.startsWith(prefix))
    .map(([key, value]) => ({ key, value: value as T }));
}
