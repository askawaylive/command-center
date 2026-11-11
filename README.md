# Command Center

One calm place to run every business: plan your day, track launches, see revenue and cash across Stripe, Shopify and Mercury, read every Gmail inbox, and ask Claude about any of it.

It runs on your own computer. Your keys stay in `.env.local` on your machine and are never committed.

## Start it

You need Node.js 20 or newer (`node -v` to check; get it from nodejs.org).

```bash
npm install
cp .env.example .env.local   # then fill in whatever keys you have
npm run dev
```

Open http://localhost:3000. Everything works right away with sample data; each area switches to your real numbers as soon as its key is added (restart `npm run dev` after editing `.env.local`).

## What's inside

| Page | What it does |
|---|---|
| **Today** | Day-by-day planner. Drag tasks between days and from your backlog, see planned time per day, turn any email into a task for today. Unfinished tasks roll forward. |
| **Launch board** | Backlog / To do / In progress / Done across all businesses. Filter by business or launch and see launch progress. |
| **Metrics** | Revenue (30 days vs previous 30), MRR, cash in Mercury, orders, a daily revenue chart by business, and per-account breakdowns. |
| **Inbox** | Every business's Gmail in one list with tabs per business. |
| **Ask Claude** | Chat with an AI chief of staff that can read your metrics, cash, tasks and email, and create or update tasks for you. |
| **Business pages** | Everything for one business on one page. |
| **Connections** | Shows which accounts are live, which are sample data, and any connection errors. |

## Connecting your accounts

All keys go in `.env.local`. Which account belongs to which business is set in `data/businesses.json` (add businesses there too).

- **Claude**: `ANTHROPIC_API_KEY` from platform.claude.com.
- **Mercury**: `MERCURY_API_TOKEN` (Mercury › Settings › API tokens, read only). Then put each account's id in that business's `mercuryAccountIds` so cash shows per business; the Connections page and Metrics page list your accounts.
- **Stripe** (one per account): `STRIPE_<KEY>_SECRET_KEY`, where `<KEY>` matches the `stripe` list in `businesses.json`. Use a restricted key with read access to Charges, Subscriptions and Balance.
- **Shopify** (one per store): in Shopify admin › Settings › Apps › Develop apps, create a custom app with the `read_orders` scope, then set `SHOPIFY_<KEY>_STORE=yourstore.myshopify.com` and `SHOPIFY_<KEY>_TOKEN`.
- **Gmail** (one per inbox):
  1. In Google Cloud Console create a project, enable the Gmail API, and create an OAuth client of type **Desktop app**. Put its id and secret in `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.
  2. Run `npm run gmail:auth -- ASKAWAY` (repeat per inbox with its key). It opens Google sign-in and saves the refresh token to `.env.local`. Access is read only.
  3. If several businesses share one Gmail account, give each the same `account` and a `query` filter in `businesses.json`, e.g. `"query": "to:hello@askaway.com"`.

## Where things live

- Tasks are saved in `data/db.json` (created on first run with example tasks; delete it to start fresh).
- Integrations: `src/lib/integrations/` (stripe, shopify, mercury, gmail). Each falls back to sample data if its key is missing or the call fails.
- The AI agent and its tools: `src/lib/agent.ts`.

## Next steps

- Wrap as a Mac/Windows desktop app (Tauri or Electron).
- Reply to email and archive from inside the app.
- More launch tooling: milestones, dependencies, recurring tasks.
