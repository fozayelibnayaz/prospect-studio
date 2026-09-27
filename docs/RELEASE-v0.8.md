# Prospect Studio v0.8.0 — release sheet

**Package:** `prospect-studio-v0.8.0-source.zip` — 59 files. Check the hash of the file you
downloaded against the one printed in the chat message that delivered it (`shasum -a 256`).
Unzip into a fresh repository root (files land at the top level, not in a sub-folder).

**Verified before packaging:** 114 Node tests + 41 Playwright tests green, syntax checks on
`src/worker.js` and `public/app.js`, no database migration required, no new secrets, the packaged
ZIP re-extracted and its tests re-run.

**How to prove which build a URL is serving** — open `https://YOUR-URL/api/version`. It is public on
purpose and contains nothing private: it returns `{"version":"0.8.0","features":[...],"markets":
{"countries":124,"cities":683}}`. The sidebar also shows `v0.8.0 · live workspace` with the same link.

**Deploying (owner):** copy `public/ src/ tests/ scripts/ package.json playwright.config.js
.github/workflows/ docs/` into your repository. **Never** copy `wrangler.jsonc` — yours holds your
real D1 id, origin and email, and it already has the two cron triggers and both `"true"` flags.
Then `npm ci && npm run deploy`.

**First five minutes after deploy**
1. Open **Automation → Automatic approval & sending** — both switches are ON. Turn either off if
   you want to approve or send by hand.
2. Open **Automation → Telegram alerts** and press **Send a test alert to Telegram**.
3. Open **Prospects** — the address-quality card shows what has been checked; press
   **Check the next 40 addresses** (free, no credits) and **Read public pages for missing emails**.
4. Open **Prospects** → select all → type your contact basis → **Mark selected approved**.
5. Open **Email activity** — the weekly-skim card shows every message the watch has seen,
   with the words that matched and the phrases your keyword list is still missing.

**Seeing it in production — exactly what to click**
1. `https://ayaz-prospect-studio.YOUR-SUBDOMAIN.workers.dev/api/version` → must say `0.8.0`. If it
   says something else, the deploy went somewhere else (wrong worker name) or Cloudflare is serving a
   cached page — hard-refresh with Cmd+Shift+R.
2. Sign in with your owner Google account (not the demo). The button under the version badge should
   read `live workspace`, not `demo data`.
3. **Automation** → top of the page: "Automatic approval & sending" with the green **ON BY DEFAULT**
   badge (this panel does not exist before v0.8). Press **Send a test alert to Telegram**.
4. **Settings** → "Global markets — all of them": **124 countries · 683 cities ready** and a
   **NOT 249** badge.
5. **Prospects** → checkbox column in the table header, an **Email** column with the check result,
   the Address quality card, and the bulk bar under the table.
6. **Email activity** → "Every message that passed through (weekly skim)" card.
7. **Review & send** → "Who is deciding" card with AUTO APPROVE / AUTO SEND badges.

**What to watch for in the first days**
- Alerts will be noisier than before, by design. Use the per-case switches (or the master switch)
  to find a volume you actually read.
- `SYNTAX_OK` means "format looks right, mail server not checked yet" — it is not a rejection.
  `NO_MAIL_SERVER` / `INVALID_SYNTAX` / `DISPOSABLE` records are blocked from sending until fixed.
- Nothing was moved to PROPOSAL / NURTURE / WON / LOST automatically. Only CONTACTED, REPLIED and
  CONVERSATION are the system's to move, and `whatMoves` in Activity lists exactly that.
