# One-time deployment — MacBook, free-tier only

This replaces daily spreadsheet operations with a web app. **It is not already deployed.** Your account authorization and actual Gmail delivery cannot be performed from this workspace.

## 0. Keep the existing system safe

- In your old Apps Script, run `stopAutopilot` before enabling discovery in the new app. Do not run two acquisition/sending engines on the same allowance unintentionally.
- Keep your existing Sheet as an archive. Do not delete its records, properties, Form, or MealKhata.
- The fixed `Autopilot.gs` status function now logs results even without a spreadsheet UI. That is independent of this new web app.
- The new app uses the **same Tavily account/key**, not a new plan. It supports KEYED mode only. There is no new `AP_SEARCH_MODE` property to maintain in Google.

## 1. Put the source at the new repository root

Unzip `prospect-studio-v0.1.0-source.zip` into a new empty folder/repository. Open Terminal in that folder:

```bash
npm ci
npx wrangler login
npx wrangler d1 create prospect-studio
```

Use your existing free Cloudflare account. No card, paid Workers upgrade, purchased domain or R2 bucket is required by this design. If Cloudflare asks for an upgrade, stop rather than enable it.

The database creation command prints a `database_id`. Open `wrangler.jsonc` and edit **only `env.production`**:

- `d1_databases[0].database_id`: paste the new database ID.
- `vars.OWNER_EMAIL`: the Google account allowed to sign in.
- `vars.APP_ORIGIN`: the exact new HTTPS Workers URL, with no trailing slash. With the supplied worker name, this is `https://ayaz-prospect-studio.YOUR-WORKERS-SUBDOMAIN.workers.dev`.
- `vars.DEMO_MODE`: leave `false`.
- `vars.TAVILY_PAYGO_DISABLED_CONFIRMED`: set `true` only while your Researcher account has PAYG disabled/not activated. You confirmed it currently requires a card to activate. Do not add a card.
- `vars.AI_FREE_CONFIRMED`: leave `false` until optional AI is separately verified.

Do **not** edit the root demo D1 binding into your real database. Keeping local and production bindings separate prevents fixture data from entering your live workspace.

Initialize the real database and deploy:

```bash
npx wrangler d1 execute DB --remote --env production --file migrations/0001.sql
npm run deploy
```

The public site can show the sign-in interface before OAuth is configured, but private API data is inaccessible. It starts paused. The included deploy check rejects placeholder IDs/origins and a production demo flag.

## 2. Configure owner Google sign-in

Use a **standard Cloud project you own** for this web app—not the inaccessible, automatically managed Apps Script project numbered 600184721087. Creating a standard project does not require enabling billing for these APIs.

1. In Google Cloud Console, create/select an owned project dedicated to Prospect Studio.
2. Set up its OAuth consent/Google Auth Platform configuration. For a personal Gmail account, use External and add your own address as a test user while testing.
3. Create an OAuth client of type **Web application**.
4. Authorized redirect URI:

```text
https://YOUR-EXACT-WORKER-HOST/api/auth/callback
```

Use the same origin as `APP_ORIGIN`. No bought domain is needed. The sign-in flow uses only identity/email until you separately connect Gmail.

5. Store the client values as Worker secrets, never in source:

```bash
npx wrangler secret put GOOGLE_CLIENT_ID --env production
npx wrangler secret put GOOGLE_CLIENT_SECRET --env production
npx wrangler secret put ENCRYPTION_KEY --env production
```

For `ENCRYPTION_KEY`, generate a random value locally with `openssl rand -hex 32` and paste it at the secret prompt. Keep a private backup; changing it without migration makes stored Gmail refresh tokens unreadable. Do not paste it into chat or Git.

Visit the deployed app and sign in. Only `OWNER_EMAIL` is accepted. Verify another Google account cannot access it. Sessions expire after seven days; signing in again does not itself send messages.

Google documentation: https://developers.google.com/identity/protocols/oauth2/web-server

## 3. Connect Tavily

```bash
npx wrangler secret put TAVILY_API_KEY --env production
```

Paste your existing key privately. The Worker checks `/usage` before chargeable requests. It requires a recognised free plan with limit at most 1,000, zero paid usage, and a zero PAYG limit—or null only with your explicit disabled-PAYG confirmation. A null key limit is not unlimited free usage.

Local ceilings: 8 search attempts, 20 extraction batches, 28 reserved credits/day, 900/month. Provider account headroom is also checked; other usage on that same account counts. Missing/paid/ambiguous configurations stop rather than fall back to payment.

In the app:
1. Leave Auto-send OFF.
2. Resume the worker.
3. Run discovery once.
4. Inspect the activity ledger, quota counters, queue results and source evidence.
5. Check actual primary-site contacts before approving anything.

Production cron is already configured in the deployment. It executes every 15 minutes; paused means no background work. Search is distributed across the day. Actual timing, free CPU limits and provider availability are not guaranteed.

## 4. Migrate existing research once

From the original **Prospect Research** Sheet, download CSV. In the new app use **Prospects → Import CSV / JSON**. Maximum 100 rows / 250 KB per batch.

Expected headers include `Company`, `Website`, `Public email`, `Public phone`, `Business address`, `Office / market`, `Evidence summary`, `Review status`. JSON may use lowercase `company`, `website`, `email`, `phone`, `country`.

Imports:
- Skip known unsafe/directory/staging sources and duplicate domains.
- Preserve HOLD status where supplied.
- Never convert imported contact details into opt-in or historical sends/replies.
- Do not count as new daily discovery.

Keep excluded/old rows in your archive rather than deleting the evidence. Consent and outcomes must be reviewed explicitly in the app. The old Google Form/CRM automations are **not automatically migrated** or continuously synchronized; existing inbound records require import until an inbound connector is added.

## 5. Gmail: connect and test before using real prospect sends

1. Enable **Gmail API** in the new owned OAuth Cloud project.
2. In the app’s Settings, choose **Connect Gmail securely**.
3. Google requests Gmail send and read-only permissions. The read scope is for bounded reply matching; no full mailbox is sent to Gemini.
4. Verify a test contact whose address you control, with explicit opt-in evidence. Keep Auto-send OFF.
5. Create/edit a draft, approve that exact message, then process one eligible message.
6. Verify Sent, actual reception, the recorded status and unsubscribe handling.
7. Only then consider enabling Auto-send opted-in and keeping the daily cap small.

**Google OAuth testing-mode warning:** apps requesting Gmail scopes can receive refresh tokens that expire after seven days in Testing. A durable personal deployment needs an appropriate consent/publishing configuration under Google’s rules. Production/unverified-app limitations, account approval and any required verification are not bypassed by this code. A key/model list or successful sign-in does not prove Gmail sending access.

Sending rules:
- Auto ON: only drafts for contacts with recorded OPT_IN, evidence, an APPROVED source, no hold/suppression and no reply/customer/lost stop can proceed automatically.
- Auto OFF: every message needs individual approval.
- Manual business contact without opt-in also requires explicit reviewed contact-basis evidence and individual approval. This is not a legal determination; country/channel rules still apply.
- Edits invalidate approval. Changed recipients require new review.
- Gmail errors after a send attempt become UNKNOWN and never blindly retry. “Check Gmail Sent” reconciles by exact Message-ID; absence does not prove non-delivery.
- Reply matching polls up to 20 recent inbox messages from seven days, requires the sent thread, matching address and contact time, and skips marked auto-submitted messages. It is not complete mailbox synchronization.
- Replies stop automatic follow-ups; new conversational replies need owner review. This is not an autonomous negotiating chatbot.
- The app does not create automatic nurture sequences from every discovered row. You create a draft and set reviewed follow-up dates/tasks.

Gmail API documentation: https://developers.google.com/workspace/gmail/api/guides/sending

## 6. Optional Telegram and AI

Telegram:

```bash
npx wrangler secret put TELEGRAM_BOT_TOKEN --env production
npx wrangler secret put TELEGRAM_CHAT_ID --env production
```

Reuse your owner bot if desired, but do not leave the old discovery engine running too. Notifications link to the authenticated report page. They do not make XLSX files public. A failed/uncertain notice is logged, not blindly resent.

Gemini:

```bash
npx wrangler secret put GEMINI_API_KEY --env production
npx wrangler secret put GEMINI_MODEL --env production
```

Use a currently available **text model with a free allowance on your unbilled project**. The previous Apps Script generation 404 remains unverified; model-list success is not generation success. Do not guess a paid model or use an unstable `latest` alias as a paid fallback.

After verifying account/model conditions, set `env.production.vars.AI_FREE_CONFIRMED` to `true` and redeploy. Gemini receives fixed skill tags and anonymous per-niche contacted/replied/won counts only. The app cannot independently inspect Google’s billing configuration; that confirmation must remain true in reality. One attempt per seven days, no Google Search grounding, no automatic model training. Advice is not automatically applied as code or messaging authority.

Outcome-adaptive targeting works without Gemini and needs at least ten contacted records per relevant cohort before exploiting its observed response rate.

Marketing, finance and customer success need no extra credentials or phases: content, campaigns, invoices, check-ins and the weekly digest run on the same worker and database. Facebook/X auto-posting is a later optional connector after your own platform app setup; LinkedIn posting stays approved copy-paste because there is no free official personal-profile auto-post API.

## 7. Daily reports, backups and acceptance

The clock stores the **previous Dhaka calendar day shortly after midnight**, so discovery can run across the full day. Reports exclude imports from fresh-discovery totals. Open Reports and download the dated private XLSX. Unlike the Apps Script version, this does not create files in Google Drive.

A manual current-day snapshot is immutable and may omit later additions; use it only for testing. Do not mistake a manual snapshot for a full unattended day.

Private database backup:

```bash
mkdir -p backups
npx wrangler d1 export DB --remote --env production --output backups/prospect-studio.sql
```

Never commit database backups, `.dev.vars`, keys or exported contact data. The repo ignores backups, but verify before pushing.

Acceptance before claiming live:
- Owner login works; other accounts and unauthenticated APIs are blocked.
- No demo data exists in production.
- Source discovery/enrichment and actual quota responses work from Cloudflare.
- Imported rows are not counted as fresh discovery.
- Own-address Gmail delivery, opt-out and reply tests pass.
- Auto OFF does not send unapproved drafts; ON does not auto-send cold contacts.
- Two unattended days produce distinct report snapshots and honest shortfalls.
- Pause, quota limits and provider failures stop safely without a paid upgrade.

If anything fails, pause in Settings and inspect the activity ledger. Do not repeatedly approve or resend uncertain deliveries.
