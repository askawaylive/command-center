export const DAY = 86_400_000;

export function isoDay(d: Date | number = new Date()): string {
  const date = typeof d === "number" ? new Date(d) : d;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return isoDay(new Date(y, m - 1, d + n));
}

export function lastNDays(n: number): string[] {
  const today = isoDay();
  return Array.from({ length: n }, (_, i) => addDays(today, i - n + 1));
}
