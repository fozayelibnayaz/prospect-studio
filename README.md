# Prospect Studio — integrated web-app pilot

A separate **Cloudflare Workers + D1** project for Fozayel Ibn Ayaz. No Google Sheet is required for the new app’s normal operation. This does not modify MealKhata.

**Deployed and running (v0.5.0 confirmed; v0.8.0 source delivered) at the owner’s Cloudflare account.** Gmail sending is live-verified end-to-end; Tavily, Gmail, Gemini and Telegram are all connected. The local preview remains explicitly fictional demo data: it cannot make discovery, AI or Gmail calls. Never put private data in that preview.

## Start here

- [One-time owner deployment](docs/DEPLOY.md)
- [QA evidence and remaining acceptance](docs/QA.md)
- [Architecture and limits](docs/ARCHITECTURE.md)
- [Source on GitHub + automatic deploy](docs/DEPLOY.md#source-on-github--automatic-deploy-from-github)

## Included

- Fourteen web-app sections: overview, prospects, review/send, email activity, pipeline, customers, marketing, growth & goals, finance, work/follow-ups, reports/learning, business map, automation, settings.
- **Automatic approval & sending are ON by default and can be switched off (v0.8):** three visible switches (auto-approve, auto-send, check addresses) on Overview, Automation, Review and Settings. Auto-approval still requires a recorded basis, an approved source, no suppression, no hold, no reply and room inside the daily cap — turning a switch off always wins, and every decision is logged.
- **Address quality with honest words (v0.8):** a free Cloudflare DoH **MX** check plus a second free pass that reads the prospect's public site and contact page for missing addresses. "Mail server found" means the domain accepts mail — it is *not* a delivery proof, and the UI says so. An address already proven unusable is never sent to.
- **Select-all + bulk actions on every list (v0.8):** select-all header, per-row selection, "Select all N shown", sorting (newest / best fit / name / has-email / city), and bulk approve · hold · unreview · draft · verify · suppress · un-suppress — approval requires the basis you typed and is stamped on every selected record. The review queue has select-all bulk approval for messages.
- **Global market (v0.8):** 124 countries and 683 real cities; each search names a city inside the country, so results are businesses rather than blogs. Focus still decides where today's credits go; the rest rotates 24×7.
- **Professional, research-grounded drafts (v0.8):** letters open with something actually seen on the prospect's public page (or they say less — never a fake compliment), with different openings for a brand-new business, an agency overflow partner and a freelancer, and a plain statement that no audit was done.
- **Per-case Telegram alerts (v0.8):** one switch per case (new prospect, every send, every reply, urgent, bounces, money, tasks, content, digest, errors) plus a master switch; every alert prints the matched words and the reason it fired, and alerts never act on your behalf.
- **Reply handling from the owner's own design (v0.8):** a follow-up task and revisit date are created at the moment of send; delivery is checked against the provider's own bounce notices before the next send; out-of-office is detected from the `Auto-Submitted` header (RFC 3834) first; only CONTACTED/REPLIED/CONVERSATION move automatically while PROPOSAL/NURTURE/WON/LOST stay yours; "not interested / don't call" is an alert and nothing more; forwards are flagged as a new sender on a known thread; and every message that passes the watch is kept for a weekly skim that also lists phrases your keyword list is missing.
- **Real business names (v0.8):** directory halves ("… | CommissionCrowd"), social tails and known directory hosts are stripped or rejected, so research rows show the business, not the listing site.
- **Urgent reply alerts (v0.6):** a free 1-minute Cloudflare cron tick watches the newest inbox mail, matches replies to your own threads, and flags "call now / urgent / ASAP / deadline / phone number" matches instantly — Telegram + owner email + URGENT flag + call-back task + Overview banner. Rules always run; the optional AI second opinion reads only the single matched reply and needs its own switch.
- **Daily Telegram summary (v0.6):** every night at ~00:05 Dhaka: new prospects, sends, replies, urgent items waiting, drafts, tasks, overdue invoices and content — with an owner-email fallback when Telegram is not connected. Weekly health check on Sundays.
- **English + Bangla (v0.6):** workspace language, per-lead reply language, bilingual outreach/check-in/welcome templates and bilingual growth playbook; optional AI translation with the built-in templates as a guaranteed fallback.
- **Deeper research (v0.6):** platform (WordPress/Shopify/Wix/…), analytics detection, socials, hiring signal and page language from the prospect's own site, plus a transparent 0–100 fit score that lists its reasons.
- **Fallback discovery (v0.6):** Tavily (900 free credits) → Google Programmable Search (free 100/day) → OpenStreetMap local mode (keyless, © OpenStreetMap contributors). Fallback extraction reads pages directly, so prospects keep arriving with zero credits; every switch is logged, shown in Automation and announced on Telegram.
- **Growth & goals (v0.7):** 30-day launch plan from five answers, monthly revenue/customer goals with pro-rata pace, first-customers playbook, content starters, weekly health check and a journey view from discovered → paid customer.
- Owner-only Google OAuth login, encrypted Gmail refresh token, expiring server sessions and origin checks. `GET /api/version` is the one public endpoint: it names the deployed build and its feature keys so production can be verified at a glance (the sidebar also shows `v0.8.0`).
- Tavily basic search/extraction; provider free-plan preflight; local daily/monthly reservations; known directory/review-site rejection; source-backed fields; domain deduplication; explicit holds and unknowns.
- 124 countries (every country and territory) with 683 cities in rotation. Broad sampling rotates countries and five prospect types — established businesses, **new business owners**, agencies, freelancers and public work requests. Focused mode uses selected countries/types. Adaptive mode uses eligible reply cohorts and retains exploration.
- New businesses, established businesses, agencies, freelancers and public work-request search hypotheses. Job advertisements are not required. Source type, location, age and demand remain unverified until reviewed.
- Immutable daily snapshots, private authenticated XLSX downloads, Email activity XLSX and full backup JSON exports, Telegram report notice, and the weekly digest also emailed to the owner’s own Gmail.
- Editable drafts; per-message approval; automatic sending inside the rules above; mandatory contact-basis evidence; global pause; suppression/unsubscribe; daily send-attempt cap; no blind retry after uncertain delivery.
- Marketing center: daily auto-drafted posts (LinkedIn/Facebook/X channels), per-post approval, post metrics, organic campaigns, rule-based marketing ideas.
- Sales completion: quotes, stage history, win/loss reasons, invoice suggestion on wins.
- Customer success: automatic day-1/7/30 check-in schedule, welcome draft, weekly Dhaka-week digest (Telegram + owner email), satisfaction scores.
- Follow-up autopilot: one review-gated nudge per quiet conversation after an owner-set delay (2–14 days), a distinct final second touch if enabled, never after a reply, hold, suppression, win or loss.
- Invoice reminders: a polite draft for each overdue unpaid invoice (manual button, or autopilot max twice, a week apart) — review-gated like every message.
- Seasonal pause windows: owner-set date ranges stop sending, follow-ups and reminders (research, replies, content and reports continue).
- Restore from backup: upload the backup JSON with a dry-run preview and add/update modes; credentials are never restored.
- Email activity: every sent message and every matched reply with its full text, filtered by direction.
- Automation screen: every worker with live state, last run and a run-now button; owner-confirmed free-tier flags (`AI_FREE_CONFIRMED`, `TAVILY_PAYGO_DISABLED_CONFIRMED`) are enforced `true` by the deploy check.
- Finance: invoice records with paid-lock, collected/outstanding totals, pipeline value.
- Gmail reply matching against sent thread IDs, sender addresses and contact dates; bounded inbox polling; owner-recorded external outcomes.
- Sales stages, review/follow-up/customer service tasks, automatic follow-up review task after a send, and an onboarding task when a lead is marked won.
- Anonymous weekly AI advice when independently configured on a confirmed unbilled Gemini project. No search grounding or raw CRM data is submitted.
- One-time CSV/JSON research import, without automatically granting consent or fabricating past results.

## Important limits

This is **not exhaustive global research, a guaranteed 50 buyers/day, unrestricted cold-mail automation or a finished enterprise lifecycle suite**. Read the explicit partial/unimplemented list in `docs/ARCHITECTURE.md`.

The Workers clock is configured every 15 minutes, around the clock. Scheduled search slots are spread about every 3 hours; at most eight basic searches/day. Enrichment is queued between them within its own cap. A global rotation over the full market list therefore takes months to touch every city once, before considering different sectors/types — which is why the focused list exists and why coverage claims are never made. English queries are used; this is not multilingual exhaustive coverage.

Discovery aims for 50 non-held research candidates/day; quotas, source availability, holds, duplicates and two-page enrichment often mean fewer. A shortfall is not filled with existing/imported rows or invented contacts.

## Source at repository root

Unzip the source package **into a new repository root** so `package.json`, `wrangler.jsonc`, `src/`, `public/`, `migrations/` and `tests/` are visible directly. Do not create a ZIP-only repository. No API keys, OAuth secrets, private CV, real prospect database or production session is included.

```bash
npm ci
npx wrangler d1 execute DB --local --file migrations/0001.sql
npm run dev
```

The default configuration is DEMO. Production is a separate Wrangler environment with **DEMO_MODE=false** and deployment validation.

```bash
npm run check
npx playwright install --with-deps chromium
# Keep npm run dev running in another terminal:
npm run test:browser
```

Tests send no real email and use no live provider key. The integration tests run genuine local D1/Workers adapters with mocked external providers.
