#!/bin/bash
# Double-click this file to start Command Center.
cd "$(dirname "$0")"

if ! command -v npm >/dev/null 2>&1; then
  echo "Node.js isn't installed yet. Opening nodejs.org — install the LTS version, then double-click this file again."
  open "https://nodejs.org/en/download"
  read -p "Press Enter to close."
  exit 1
fi

[ -f .env.local ] || cp .env.example .env.local
[ -d node_modules ] || { echo "First run: installing (takes a minute or two)…"; npm install || { read -p "Install failed. Press Enter to close."; exit 1; }; }

echo "Starting Command Center at http://localhost:3000 — keep this window open while you use it."
(sleep 6 && open "http://localhost:3000") &
npm run dev
