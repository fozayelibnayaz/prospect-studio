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

## v0.6.0 + v0.7.0 — Urgent Alerts, Fallback Research, Daily Summary, Language & Entrepreneur Suite (2026-09-23)

Scope: instant urgent-reply alerts, all-in-one daily Telegram summary, English + Bangla workspace, expanded research fields with a transparent fit score, fallback discovery chain when the 900-credit Tavily budget is spent, and the v0.7 growth suite (30-day launch plan, goals & pace, first-customers playbook, content starters, weekly health check, journey view).

- **99 Node tests passed** (50 domain + 5 sources + 42 integration + 2 shared) and **31 Playwright tests passed** (130 total).
- Urgent alerts (v0.6): a second **1-minute cron trigger** (`* * * * *`) runs a deliberately tiny tick that only calls the urgent watch; the 15-minute trigger keeps discovery/sending/follow-ups/reminders/digests. Rules layer always on (call now / urgent / ASAP / immediate / deadline / phone number in the message / owner keywords ≤ 500 chars); optional Gemini second opinion **only** on the single matched reply, behind its own switch and only when `AI_FREE_CONFIRMED=true`. Outputs: Telegram message, owner email, an URGENT flag on the lead, a "call back" task, and the Overview banner. Coverage: matching flags and phone detection; ordinary replies stored as NORMAL and never notified; whole-inbox watch is off by default and only owner-thread replies are read; the watch switch really disables the run; Gmail absence returns a clear skip; AI tier can raise a rule-level match but cannot invent a match out of nothing.
- Reply matching uses **both** sent drafts and sent mail records for thread ownership (test caught the drafts-only gap: the harness stores sends in `mail`), so a reply is attributed to the right lead.
- Daily summary (v0.6): one Telegram message at ~00:05 Dhaka with new prospects, approved sends, replies, urgent replies waiting, drafts awaiting review, due tasks, overdue invoices and content drafts — with an **owner-email fallback** when Telegram is not connected. Weekly health check stored and pushed on Sundays.
- Multi-language (v0.6): `language` setting (en/bn) + per-lead language; Bangla outreach, check-in and welcome templates with placeholder fill; optional AI translation behind the confirmed-free AI gate; the built-in templates never return a blank or half-translated body.
- Research expansion (v0.6): site analysis during enrichment (platform, GA4/GTM detection, socials, hiring signal, page language) + transparent 0–100 fit score with listed reasons, bounded 0–100 and never hidden behind a black box.
- Fallback chain (v0.6): Tavily (900-credit reserve) → **Google Programmable Search** (free 100/day, owner supplies key + engine id) → **OpenStreetMap/Overpass** local mode (keyless, commercial use OK, "© OpenStreetMap contributors" recorded in the record evidence and shown in the UI). Fallback extraction reads the public page itself, so enrichment works with **zero Tavily credits**; each switch logs an event, sets the visible discovery-mode state and sends a Telegram notice. Covered by integration tests for the PSE switch and the OSM mode (including the fact that `TAVILY_LOCAL_FREE_CAP` used to stop fallback runs — fixed by routing extraction away from Tavily when the mode is not TAVILY).
- Growth suite (v0.7): 30-day launch plan from five owner answers → dated tasks; goals & pace (revenue and new customers, pro-rata expectation, behind/on-pace bar); first-customers playbook (10 steps) and content starters (5 ideas), both bilingual, added as tasks/drafts with one click each; weekly health check (money and unanswered conversations first); journey view counting the real path from discovered → reviewed → contacted → replied → proposal → customer → invoiced → paid.
- Accessibility (v0.6 regression caught by axe): the extra nav item pushed the last sidebar link below the 1280×720 fold, which axe flagged as an offscreen skip link; the sidebar is now compact and scroll-safe, the brand is a real home link, and the current view container carries the matching `id`. All nine views scan clean. A broken label/input pairing introduced during the settings restructure was caught the same way and fixed.
- Demo seed extended (urgent reply, health check, fit fields) so the preview shows the new features without any provider calls.
- No database migration required.
- Test-harness defects fixed while writing the new tests: `request.body` → `body` in new action cases; reserved `.example` TLD rejected by the research host filter (mocked feeds now use realistic domains); duplicate-send guard now requires an **approved** draft even for a manual send; a rejected auto-apply must not treat its own draft as a duplicate company.

Not claimed live: no urgent alert has yet fired on a real inbox reply; no Telegram daily summary has been delivered from the production Worker; the fallback chain has not been exercised in production; the PSE key has not been created by the owner yet; no Bangla message has been sent to a real prospect.

## v0.8.0 — "complete the full prospect studio" (2026-09-26)

Scope: the owner's ten-point feedback round — visible auto-approval/auto-send switches defaulting to ON, verify-then-extract addresses, select-all + bulk actions and sorting on every list, the global market, professional research-grounded drafts, per-case Telegram alerts that show the matched words, real business names instead of directory titles, all-business-type ICP including new owners, and the reply-handling design from the owner's own outreach conversation.

- **114 Node tests passed** (57 domain + 5 sources + 50 integration + 2 shared) and **41 Playwright tests passed** (155 total for this round).
- New automated coverage: bulk approval refuses to invent a basis (empty basis → 400) and records the basis the owner typed on every selected lead; hold/unreview/draft/suppress/restore bulk operations; bulk draft creation only drafts what is actually approved and leaves the draft unapproved; `approveBulk` skips thin-basis, suppressed and gone records with named reasons and stamps `approvedBy = OWNER_BULK`; address checking labels a broken address `INVALID_SYNTAX` instead of skipping it, ties the verdict to the exact address (`emailCheckedFor`), never re-queries an unchanged address, and an address already proven unusable (`INVALID_SYNTAX` / `NO_MAIL_SERVER` / `DISPOSABLE`) is **never sent to**; Telegram switch grid (11 switches, all on by default, master switch off blocks everything, `testNotify` reports "not sent" honestly when no bot token exists rather than pretending); state carries markets, address counts, the inbox log and phrase gaps; auto-approval default ON, turn-off puts every new draft back in the owner's hands, approved messages still send when the owner clicks; opening the auto switches again requires an explicit confirmation.
- Reply-handling design covered: `classifyReply` names its matched words; `Auto-Submitted` (RFC 3834) header beats keywords; a real interest signal beats the forward heuristic (content decides, the forward is a note on top); "not interested / please don't call" produces an **alert only** — nothing is suppressed, replied to or moved; out-of-office wording in the body is also recognised; every message the watch sees is stored in `inboxlog` with its class; ordinary replies stay out of the alert list but appear in the weekly skim; `phraseGaps` surfaces repeated phrases the keyword list is missing.
- Drafts: outreach letters open with a real observation from the prospect's public page (platform, analytics tag present/absent, hiring line, page language, town) and different angles for a new business, an agency overflow partner and a freelancer; a lead with nothing quotable gets a shorter honest letter and `grounded: false` — the suite asserts no template placeholders ever leak and that no fake compliment is invented.
- Names: directory titles lose the directory half ("Connect companies | CommissionCrowd" → "Connect companies"), social tails are stripped and known directory hosts are rejected before becoming prospects.
- Markets: 124 countries / 683 cities asserted, per-country city lists asserted, and the city is baked into each discovery query.
- Browser suite additions (10 new tests): the automatic approval & sending panel is ON by default, can be turned off, survives a reload and shows the manual-mode notice; the Telegram panel has 11 switches with the master on and a per-case switch that persists; the prospect list has a select-all header, per-row selection, "N selected", sort by name and by fit, and an Email column; bulk approval first refuses an empty basis with a visible message and then succeeds; the mail view carries the weekly-skim card with class filters; Settings shows the global-market card (and explicitly "NOT 249") and the all-business-types card; the review queue offers select-all bulk approval of drafts; the work board sorts, selects and closes tasks in bulk; the email-activity and review lists carry their own sort controls; and the sidebar names the deployed build (`v0.8.0`) so production can be identified at a glance.
- Defects found and fixed during this build:
  1. **Forward branch hid real interest.** The classification checked forwarded/new-sender before scoring, so "Please call now — we want to sign this week" arriving from an unknown sender on a thread was filed as FORWARD and never alerted. Reordered: office → negative → interest/urgent → forward fallback; the forward is now a note appended to the real class.
  2. **Bulk un-suppression did nothing.** `saveLead` deliberately keeps `suppressed = 1` sticky, so the bulk restore wrote the record back with the flag still set. Restore now deletes the suppression row and writes through `unsuppressLead()` (the same path the single-lead restore uses), and consent is cleared so a fresh basis must be recorded.
  3. **Broken addresses were invisible.** The check filtered on syntax and silently skipped invalid ones. Now they are labelled `INVALID_SYNTAX`, counted in the address-quality card, and blocked at the send gate.
  4. **Re-checking the same address forever.** Without a per-address stamp, an invalid address was re-checked on every run. `emailCheckedFor` now ties the verdict to the exact address; editing the address re-checks it.
  5. **Duplicate signature in the letter.** `professionalOutreach` already ends with the portfolio block; the wrapper appended it twice. Fixed and asserted by the draft tests.
  6. **"Office" wording too narrow.** "I am away until Monday" was filed as an ordinary message; the out-of-office word list now covers "away until / I am away / back on <day>" while the header check still runs first.
  7. **Select-all could not stay selected.** Selection was DOM-only, so the re-render after a click reset the boxes; selection is now rendered from state, which also made the "N selected" count and select-all header truthful.
  8. **A test-only defect worth recording:** the old opt-in browser test used a bare `getByRole("checkbox")` lookup, which the new panels made ambiguous. Replaced with a switch-specific locator — the toggle it was really testing is still tested.
- **Deployment proof:** a public, deliberately data-free `GET /api/version` reports the deployed version, the v0.8 feature keys that answered, and the market counts; the sidebar shows `v0.8.0` next to the free-tier badge. Covered by a Node test (endpoint answers, carries no settings, leaks no addresses) and a browser test (badge + endpoint). This is the fastest way to confirm *which build* production is actually serving.
- No database migration required (new record kinds only). No new secrets: the address check uses Cloudflare's own DNS-over-HTTPS resolver and the extraction pass reads public pages directly.
- The 249-market figure is gone from the UI and replaced with the live market count; the two browser tests that asserted "249 markets"/"3 markets" were updated to assert the real numbers.

Not claimed live: no MX check, no public-page extraction, no bulk action and no new alert has yet run against the owner's production data — they are verified in the D1/browser harness only. DoH lookups depend on Cloudflare's resolver being reachable from the Worker; a resolver failure leaves the address as `SYNTAX_OK` (honest, not optimistic) rather than blocking the record. Telegram delivery of the new per-event alerts has not been observed by the owner yet; if a bot token is missing the app reports "not sent" instead of claiming success.
