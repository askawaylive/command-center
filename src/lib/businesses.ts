import fs from "node:fs";
import path from "node:path";
import type { Business } from "./types";

const FILE = path.join(process.cwd(), "data", "businesses.json");

export function getBusinesses(): Business[] {
  return JSON.parse(fs.readFileSync(FILE, "utf8")) as Business[];
}

export function getBusiness(id: string): Business | undefined {
  return getBusinesses().find((b) => b.id === id);
}
