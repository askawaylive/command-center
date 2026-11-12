// Shared by middleware (edge) and route handlers. Web Crypto only.
export const SESSION_COOKIE = "cc_session";

export function authEnabled() {
  return Boolean(process.env.APP_PASSWORD);
}

export async function sessionToken() {
  const secret = process.env.SESSION_SECRET || process.env.APP_PASSWORD || "";
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`cc-session-v1:${process.env.APP_PASSWORD}`));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
