# QA — integrated app pilot, 2026-09-21

## Executed locally

- 45 Node tests: 36 domain/export/auth-gate tests and 9 Workers/D1 integration tests with **mocked** external providers, including the OAuth callback, wrong-account denial, state replay, WON side effects (check-in schedule, welcome draft, invoice), loss-reason enforcement, per-day content idempotency, invoice payment lock and weekly digest.
- **16 Playwright tests passed** (run twice on fresh state), including axe scans of nine views. Browser suite covers navigation, evidence modal, source holds, draft/approval rejection without evidence, persisted targeting and sending toggle, task completion, keyboard Escape, XSS-as-text, mobile overflow, XLSX download and axe accessibility scans.
- Production bundle dry-run succeeded. It did not deploy or validate owner credentials.
- XLSX opened through Python openpyxl: Daily summary + Prospects sheets; formula-like untrusted company text remains a string, not an executable formula.

Logs: `unit-results.txt`, `browser-results.txt`, `deploy-dry-run.txt`.

## Defects caught and fixed during this build

- Local runtime did not support the initial future compatibility date; pinned a supported compatibility date.
- Direct Miniflare tests needed explicit ES-module rules for imported source modules.
- A paused send returned an empty response; now returns a structured paused result.
- Empty action table headers and borderline muted-text contrast failed axe checks; corrected.
- Reply/customer states, recent contacts, changed recipient approval and suppression must override automatic mode.
- Existing source filtering includes the owner-discovered Trustpilot attribution defect; known installer directories/staging hosts also rejected in the new worker.
- Draft editing clears approval; uncertain delivery is never blindly retried.
- A render-time self-click defect in the new Marketing/Finance/Customers controls (handlers firing on every render instead of on click) was caught by the browser suite and fixed; the stuck-work-lease exposure was reduced from 15 to 3 minutes.
- Demo mode never invokes live source, AI or message providers.

## Not claimed tested/live

No real Cloudflare production deployment, Google OAuth consent, live Gmail delivery/opt-out/reply, owner Gemini generation or two unattended scheduled days has been completed for this new app. Prior Google Sheets discovery/export evidence is not evidence that these new Cloudflare integrations have passed live acceptance.

The wider marketing/nurture/churn/behaviour suite remains partial as listed in ARCHITECTURE.md. Test success is not a perfection, deliverability, buyer-demand or unlimited-free-operation guarantee.

## v0.3.0 — Visibility & Autopilot (2026-09-22)

Scope: Email activity view (sent + received + full reply text), marketing autopilot (owner topics with optional IDs, posts-per-day quantity, write-from-concept, update-any-post with versioning), Automation overview (every worker with status, last run and run-now), Overview "needs attention" strip, reply-watch setting.

- **58 Node tests passed** (39 unit + 19 integration on real local D1 with mocked providers), including: full-body reply extraction (multipart/base64url/HTML-stripped), reply dedupe, auto-submitted and foreign-thread exclusion, reply-watch-off short-circuit, concept validation (5–500 chars), update version bump + DRAFT reset, topic/quantity generation determinism, and autopilot settings validation.
- **20 Playwright tests passed**, including axe scans of the new mail, automation and marketing views, email activity row → full-text modal, automation quick actions, concept write + update flow, and the overview attention strip.
- Demo seed now includes one SENT outreach draft and one matched reply so Email activity demonstrates both directions in the local preview (fictional records).
- Defect caught by tests: `Buffer` is not available in this workerd build — base64url decoding was rewritten on `atob` + `TextDecoder` and re-verified by the integration suite.
- A pre-existing browser test that relied on DOM order of the first metrics input was made deterministic by tracking the post id.

### Live verification added on this date (from production, v0.2.3 worker)

The owner's approved own-address test draft was **sent by the live 15-minute cron worker and received by the owner without any manual action** — Gmail send is now live-verified end-to-end (approve → cron → Gmail → inbox). This supersedes the earlier "live-unverified" caveat for sending. Reply match, suppression and unsubscribe remain verified only in test harnesses, not yet in production traffic.

Not claimed live: production reply matching (no prospect reply has occurred yet) and two unattended scheduled days remain outstanding.

Connection status update (2026-09-22, production worker): all four providers show CONFIGURED in Settings → Account connections — Tavily, Gmail, Gemini (owner confirmation `AI_FREE_CONFIRMED=true` set as a production variable; secrets `GEMINI_API_KEY` + `GEMINI_MODEL=gemini-2.5-flash` present), and Telegram (`TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` present). "Configured" proves secrets are bound to the production worker, not that a live call succeeded. First live calls pending owner-run tests: "Ask connected AI" (Reports & learning / Automation view) and "Build weekly digest" (Customers → Telegram delivery). Update this line once each result is observed.

## v0.4.0 — Follow-through, Delivery & Portability (2026-09-22)

Scope: follow-up autopilot (review-gated, default on, 2–14 day wait, 1–2 extra touches), owner digest email via the owner's own Gmail, Email activity XLSX export, full backup JSON export, automation + reports UI updates.

- **66 Node tests passed** (38 unit + 26 integration + 2 shared), including: follow-up created exactly once for a backdated quiet conversation and idempotent on re-run; no follow-up after a reply, on HOLD, when suppressed, on WON or when the last send is recent; `followUpMax` respected (second touch allowed, third refused); switch off short-circuits; follow-up copy contains no invented numbers or guarantees and states the stop request; settings ranges 2–14 / 1–2 enforced; multi-sheet XLSX is a real OOXML zip; export routes return real files with correct filenames; backup JSON excludes credentials; digest emails the owner's own address only and creates **no** send-budget row.
- **22 Playwright tests passed**, including follow-up settings round-trip (persisted after reload), run-now toast, and both export downloads with correct filenames; axe scans still clean.
- Defect caught in review before tests: the run-followups toast checked a response field that did not exist (silent wrong message); corrected to the actual payload and covered by the browser test.
- No database migration required (EAV `objects` table; new behaviour reuses drafts/tasks/events kinds).

Live status: v0.3.0 is deployed on the production worker and confirmed working by the owner; all four connections (Tavily, Gmail, Gemini, Telegram) show CONFIGURED. Still pending owner-run confirmation: the first live "Ask connected AI" call and the first live Telegram digest delivery.

Not claimed: production follow-up sends, production reply matching (no prospect has replied yet), or restore-from-backup (export only; restore is a v0.5 candidate).

## v0.4.1 — confirmation flags locked + GitHub delivery (2026-09-22)

- `env.production.vars.AI_FREE_CONFIRMED` and `TAVILY_PAYGO_DISABLED_CONFIRMED` now ship as `"true"` in the template `wrangler.jsonc` (both are standing owner confirmations: Gemini on the free tier, Tavily with no PAYG/card).
- `scripts/check-deploy.mjs` now **refuses to deploy** if either flag is not exactly `"true"`, with an actionable error. Verified: a realistic config passes; flipping `AI_FREE_CONFIRMED` to `"false"` aborts the deploy. This makes a silent regression impossible for both manual `npm run deploy` and CI deploys.
- GitHub: repo already ran `qa.yml` (node checks + 66 Node tests + 22 browser tests on push/PR). Added `.github/workflows/deploy.yml` — tests, validates `wrangler.jsonc`, then deploys `--env production` on push to `main`, and **skips cleanly with a notice** until `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` repository secrets exist.
- Docs: DEPLOY.md now documents the flag policy, the GitHub setup and the private-repo rule; README updated to v0.4.1 with the real live status.
- Tests after changes: 66/66 Node, 22/22 browser.

## v0.4.2 — CI flake fixed, GitHub check made self-diagnosing (2026-09-22)

Owner reported the first GitHub "App checks" run failing. Evidence from the run log: the Node step (`npm run check`) passed in GitHub; the browser step (`npm run test:browser`) exited 1. Reproducing the exact CI conditions locally (fresh clone, fresh D1 state, `npm ci`, `CI=true`) passed, so the reported log did not contain the failing test's error — the workflow was not telling us which test failed.

Root cause found while investigating (a genuine, previously intermittent flake, ~1 in 3 runs):
- `generateContent()` stamped `createdAt: new Date().toISOString()` on each generated item, so comparing two generations a millisecond apart produced unequal objects. The determinism tests (v0.3.0 topics test and the older template test) compared results with deep equality and could fail at random — locally and in CI.
- Fixed at the source: generated content is identified by its date, so `createdAt` is now derived from `dateISO` (deterministic). Verified with 8 consecutive full Node runs, all 66/66.

CI hardening (so a red build is always explained):
- `scripts/ci-report.mjs` — new step prints a readable "BROWSER TEST DIAGNOSTICS" block into the job log: totals, run-level errors (e.g. web-server startup failure), and for each failing test its file:line plus every attempt's error message. Verified against a real deliberately-failing test.
- `playwright.config.js` — CI gets one retry (flakes no longer fail the build, but every attempt is still printed), 60 s test timeout, 10 s expect timeout, trace retained on failure, and web-server stdout/stderr piped.
- `qa.yml` — always uploads `test-results/` and `docs/*.png`, runs the diagnostics step on failure, 20-minute timeout.
- `deploy.yml` — now triggers on `main` **and** `master` (the repo's default branch is `master`; previously a push there would not have deployed).

Known-benign in the run log: the "Node 20 is deprecated" message refers to GitHub's own action runtimes (checkout/setup-node/upload-artifact), not to this project, which pins Node 22. No action required.

Owner-confirmed working (2026-09-22): the v0.4.2 folder update, `git push` and the GitHub "App checks" run are all working from the owner's Mac, including the deploy workflow on `master`. The workspace copy remains the source of truth for code; individual run history lives on the GitHub Actions page.

## v0.5.0 — Portability, Money Follow-through & Pacing (2026-09-22)

Scope: restore from backup (dry-run preview, add/update modes), invoice reminders (manual + autopilot), second follow-up angle, seasonal pause windows.

- **78 Node tests passed** (42 unit + 34 integration + 2 shared) and **25 Playwright tests passed** (103 total). New coverage: pause-window parsing/matching/validation (single date, reversed range, malformed line, broken stored value ignored safely); both follow-up angles distinct with the second stating finality; invoice-reminder copy factual and pressure-free (subject carries amount, currency and due date); restore dry-run writes nothing; add mode never clobbers existing records; update mode replaces them; `credentials` and unknown kinds skipped even when present in the file; foreign files and bad modes rejected; metadata-only snapshot download returns a clear 400 instead of crashing; reminders created once per overdue invoice, skipped when paid/not-due/suppressed/on-hold/pending/spaced, capped at two; sending a reminder stamps the invoice; pause window blocks sends, follow-ups and reminders while discovery continues.
- Defect caught by the browser suite: the manual "Reminder draft" button was blocked by the **autopilot** switch. Corrected — the switch and pause windows now govern the automatic sweep only; an explicit owner click still drafts for review (and never sends).
- Two older browser tests were made order-independent (they had assumed invoice row order and shared suite state) so the suite is deterministic in any order.
- Demo seed now includes one overdue invoice so the reminders feature is visible in the preview.
- No database migration required.

Not claimed live: production restore has not been exercised against real owner data, and no invoice reminder has been sent to a real customer.
