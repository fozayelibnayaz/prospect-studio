# PLAN v0.8 — "complete the full prospect studio" — delivered

Build record for the round the owner opened after v0.7 was packaged. The owner's message is
treated as the approved requirement list (same whole-system-at-once process as v0.6/v0.7:
research → plan → build → QA → check → finalize → share, no piecemeal updates).

## The owner's list, item by item, and where it lives now

| # | Owner's words | What was built | Where |
| --- | --- | --- | --- |
| a | "no auto-review approval option is there. no email auto-sends there. I need to toggle auto on or off. default should be on. i can off that." | `autoApprove` **and** `autoSendOptIn` default `true`, three visible switches (approve / send / check addresses) on **Overview → Automation → Review → Settings**, each with an OFF state that is honest about what will not happen | `src/domain.js` `defaults`, `src/worker.js` `sendOne` auto-approve block, `public/app.js` `autoPanel()` + `reviewAutoBar()` |
| b | "if the email is verified, then get it extracted" | Free address check (Cloudflare DoH **MX** lookup — "domain accepts mail", never delivery proof), then a second free pass that reads the prospect's own public site + contact page for missing addresses. Verdict stored per lead with the exact address it was checked against | `src/worker.js` `mxLookup` / `verifyLeadEmail` / `verifyEmails` / `findMissingEmails`, `EMAIL_STATUS_LABEL`, actions `verifyEmails` / `findEmails` / `emailStatuses` |
| c | "select all options is missing; mark all as approved where?" + "for all lists, the select all sort function must be there" | Every prospect list has a select-all header box, per-row boxes, "Select all N shown", sort by newest / best fit / name / has-email / city, and bulk **approve · hold · unreview · draft · verify · suppress · un-suppress**. The review queue has the same select-all + bulk approval for drafts, the work board has select-all + bulk close/reopen, and every list that is a list (drafts, email activity, tasks) carries its own sort control. Money actions stay one-by-one on purpose: an invoice or a payment is never bulk-fired | `public/app.js` `table()`, `prospects()`, bulk bar, `src/worker.js` `bulkLeads` / `approveBulk` |
| d | "I have only 249 market? it should be expanded; i want the global market all possible." | 124 countries (every country and territory) with 683 real cities; each discovery query names a city inside the country so results are businesses, not blogs. Focus still decides today's spend; the rest rotates 24×7 | `src/markets.js` `MARKET_CITIES` / `cityFor` / `cityFor`-seeded queries, `state.marketCities` |
| e | "professional … research-based … not spam AI template" | Outreach letters open with an observation actually taken from the prospect's public page (platform, missing/added analytics tag, hiring line, page language, town) and say plainly that no audit was done. Different opening for a brand-new business, an agency overflow partner and a freelancer. No placeholders, no invented praise. If nothing was found, the letter says less — it never invents a compliment | `src/domain.js` `professionalOutreach` / `researchLine` / `observation`, `makeLocalizedDraft(..., "outreach")`, draft card shows "Why this is personal" |
| f | "i am only getting 2 daily alerts at one time. i need more alerts in telegram for all cases" + "where is the word matching from the email?" | Per-event alerts with individual switches (new prospect, every send, every reply, urgent, bounces, money, tasks, content, digest, errors) plus a master switch. Every alert prints the **matched words** and the reason it fired; urgent/normal/negative/forward are separate alert streams. Alerts only — never an automatic reply, suppression or status change | `src/worker.js` `notify()` / `NOTIFY_KEYS` / `NOTIFY_KEY_META`, `notifyPreview`, `testNotify`, `urgentWatch` message text |
| g | "Connect companies… | CommissionCrowd — why no name?" | Directory and social titles are stripped back to the real business: directory brand halves are dropped, "… \| Home", "… on Facebook" tails removed, known directory hosts rejected before they become a prospect | `src/domain.js` `cleanCompanyName` / `isDirectoryName` / `DIRECTORY_DOMAINS`, applied on every discovery record |
| h | "all business types, including new business owners" | Five in-scope prospect types kept as equals (established, **new business**, agency partner, freelancer partner, public work request); new businesses get their own search wording, their own letter angle and the same review standard | `src/worker.js` discovery query builder, `src/domain.js` `professionalOutreach` |
| i | reply-handling design from the pasted outreach conversation | See the table below — each rule is implemented and tested | `src/domain.js` `classifyReply` / `phraseGaps`, `src/worker.js` `urgentWatch` / `sendOne` / `bounceSweep` |
| j | "Yes, job rader in different worker" | Job Radar remains its own Worker, own D1, own URL, one extra OAuth redirect URL — untouched by this round | `job-radar/` (v1.0.0, unchanged) |

### Reply-handling rules from the owner's design, and their implementation

| Rule as agreed | Built as | Test |
| --- | --- | --- |
| A follow-up is created at the moment of send, not later | `sendOne` writes the follow-up task with `revisitAt = send + followUpDays` and stamps `parkedAt` on the lead | integration: send creates task + revisit date |
| Every parked thread gets a revisit date | same task carries `due` = `revisitAt`; lead shows it; Work board lists it | integration + browser |
| "Sent" is not self-certified | the send is recorded as accepted by the provider, then the provider's own delivery log is read (Gmail DSN / bounce query) before the next send | integration: bounce sweep before sends |
| Bounces are read before the next send | `bounceSweep()` runs at the top of `sendOne`, hashes the bounced address into suppression, marks the lead `bounced` and alerts | integration: "bounce sweep suppresses the address" |
| Auto-move only what the system observed itself | `AUTO_STAGES = CONTACTED, REPLIED, CONVERSATION`; `whatMoves` action prints exactly which statuses the system may change and which are owner-only | integration: `whatMoves` |
| Manual-only statuses stay manual | `MANUAL_STAGES = PROPOSAL, NURTURE, WON, LOST` are never set by a reply or a sweep | integration: `whatMoves` |
| Out-of-office comes from the `Auto-Submitted` header (RFC 3834) before keywords | header check runs first, keyword fallback second, both produce `OFFICE` and no action | domain + integration |
| "not interested / please don't call" → alert only | classified `NEGATIVE`, alerted to Telegram + owner email, **nothing** suppressed, replied to or moved automatically | domain + integration |
| Forwards = a new sender on a known thread | new sender on a known thread is a note on top of the classification — real interest is never hidden behind the forward | domain test asserts interest beats forward |
| Non-hits are stored for a weekly skim | `inboxlog` stores **every** message that passes the watch with its class and matched words; `phraseGaps` lists repeated phrases your keyword list is missing | integration: inbox log + gaps |

## Deployment proof

`GET /api/version` (public, no login, no private data) returns the deployed version, the v0.8 feature keys
and the market counts, and the sidebar prints `v0.8.0` plus a `/api/version` link. Anyone can confirm in two
seconds which build a URL is serving.

## New surfaces

- Actions: `bulkLeads`, `approveBulk`, `verifyEmails`, `findEmails`, `bounces`, `inboxLog`,
  `emailStatuses`, `whatMoves`, `notifyPreview`, `testNotify`.
- Object kinds: `inboxlog`, `bounces`, `suppression` (extended), `runtime`.
- UI: bulk bars on Prospects and Review, address-quality card with honest labels, inbox log with
  class filters, Telegram switch grid, global-markets card, "who counts as a prospect" card,
  auto-approval panel on four views.
- No new secrets and no new paid service: the address check uses Cloudflare's own DNS-over-HTTPS
  resolver and the extraction pass reads public pages directly.

## Hard rules that still shape everything

- `AI_FREE_CONFIRMED` and `TAVILY_PAYGO_DISABLED_CONFIRMED` stay exactly `"true"`; both deploy
  checks block otherwise. No card, no pay-as-you-go, no paid hosting, no paid API.
- Auto-approval never bypasses a rule: recorded basis ≥ 12 characters, not suppressed, not held,
  source kept, daily cap respected, replied threads excluded. Turning the switch off always wins.
- A verified address means the **domain accepts mail**; it is never called delivery proof, consent
  or intent. Labels say so in the UI, in Telegram and in the log.
- Public-page observations are quoted as "what the public page shows", never as an audit result.
- Bulk approval is still an owner decision: it is recorded with the basis the owner typed and it
  lands in Activity like every other decision.

## Test evidence for this round

| Suite | Count | Command |
| --- | --- | --- |
| Prospect Studio Node | 114 | `npm test` |
| Prospect Studio browser | 41 | `npm run test:browser` |
| **Total for v0.8** | **155** | |
| Job Radar (unchanged, previously green) | 24 + 13 | in `job-radar/` |

Defects found and fixed while building this round, plus what is *not* claimed live:
`docs/QA.md`.
