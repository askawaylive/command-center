// Connect one Gmail inbox: npm run gmail:auth -- ASKAWAY
// Opens Google sign-in, then saves GMAIL_<KEY>_REFRESH_TOKEN into .env.local.
import http from "node:http";
import fs from "node:fs";
import { exec } from "node:child_process";

const key = (process.argv[2] || "").toUpperCase();
if (!key) {
  console.error("Usage: npm run gmail:auth -- <KEY>   (KEY matches gmail.account in data/businesses.json)");
  process.exit(1);
}

const envFile = ".env.local";
const env = fs.existsSync(envFile) ? fs.readFileSync(envFile, "utf8") : "";
const read = (name) => env.match(new RegExp(`^${name}=(.*)$`, "m"))?.[1]?.trim();
const clientId = read("GOOGLE_CLIENT_ID");
const clientSecret = read("GOOGLE_CLIENT_SECRET");
if (!clientId || !clientSecret) {
  console.error("Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.local first (Google Cloud › APIs & Services › Credentials › OAuth client, type Desktop app).");
  process.exit(1);
}

const PORT = 53682;
const redirect = `http://127.0.0.1:${PORT}/callback`;
const url =
  "https://accounts.google.com/o/oauth2/v2/auth?" +
  new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirect,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/gmail.readonly",
    access_type: "offline",
    prompt: "consent",
  });

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, redirect);
  if (u.pathname !== "/callback") return res.end();
  const code = u.searchParams.get("code");
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirect, grant_type: "authorization_code" }),
  });
  const json = await r.json();
  if (!json.refresh_token) {
    res.end("No refresh token returned. Check the terminal.");
    console.error(json);
    process.exit(1);
  }
  const line = `GMAIL_${key}_REFRESH_TOKEN=${json.refresh_token}`;
  const re = new RegExp(`^GMAIL_${key}_REFRESH_TOKEN=.*$`, "m");
  const current = fs.existsSync(envFile) ? fs.readFileSync(envFile, "utf8") : "";
  fs.writeFileSync(envFile, re.test(current) ? current.replace(re, line) : current.trimEnd() + "\n" + line + "\n");
  res.end(`Connected ${key}. You can close this tab and restart Command Center.`);
  console.log(`Saved GMAIL_${key}_REFRESH_TOKEN to .env.local`);
  server.close();
});

server.listen(PORT, () => {
  console.log(`Opening Google sign-in for ${key}…\nIf it doesn't open, visit:\n${url}\n`);
  const opener = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start \"\"" : "xdg-open";
  exec(`${opener} "${url}"`);
});
