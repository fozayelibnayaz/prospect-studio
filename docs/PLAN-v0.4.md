# Prospect Studio v0.4.0 — Plan: Follow-through, Delivery & Portability

Owner directive: continue the loop (plan → build → QA → finalize → suggest). v0.3.0 is live and confirmed working; all four connections are CONFIGURED.

Gaps this round closes:
- Silence after outreach is handled by nothing today: a sent message with no reply simply ends. The single biggest value leak in the lifecycle.
- The weekly digest only reaches Telegram. Gmail is already live-verified, so the owner's own inbox is the most reliable channel.
- There is no way to get data *out* of the app (no export of email activity, no full backup). A SaaS the owner "only oversees" must be portable.

## Scope

### 1. Follow-up autopilot (review-gated by default)
- New settings: `followUpOn` (default **true**), `followUpDays` (2–14, default **4**), `followUpMax` (1–2 extra touches, default **1** → max 2 messages per prospect ever).
- Rules (deterministic, cron-driven every 15 min, after the send queue drains):
  - Needs a sent message older than `followUpDays` days.
  - Skips: any reply (`replyAt`), HOLD, suppressed, WON, LOST, or a lead with any unanswered draft already queued.
  - Creates ONE `kind:"followup"` DRAFT (subject `Re: <original>`) plus an oversight task so it appears on the Work board.
  - Never generates a third touch; never follows up after a reply. Approval gate unchanged: it sends only under the existing rules (approval, or the owner's auto-send opt-in setting for recorded opt-in contacts).
- Copy is honest: no invented claims, no pressure, explicit "tell me and I'll stop", portfolio link, no numbers.

### 2. Weekly digest by email
- Cron (Sunday) and the manual "Build weekly digest" button email the digest to `OWNER_EMAIL` through the owner's own Gmail — not outreach, so it never consumes the daily send cap and cannot touch prospects.
- Telegram remains; Gmail is added, not replaced. Failures are logged, never retried blindly.

### 3. Exports (Reports view)
- **Email activity XLSX** — two sheets (Sent / Received) with date, business, address, subject and a truncated body.
- **Full backup JSON** — every record kind except encrypted credentials; report internals stripped. Download-only (documented), so no accidental overwrite path exists.

### 4. Oversight surfaces
- Automation view: new **Follow-up autopilot** row (status, days, last run, "Run follow-ups now") plus an inline settings card (toggle, days, max touches).
- Review & send: follow-up drafts are tagged `FOLLOW-UP` so the queue stays readable.
- Reports: two new download buttons.

## QA gates
- Unit: follow-up copy honesty, settings validation ranges.
- Integration (real D1, mocked providers): backdated sent lead → exactly one follow-up draft; idempotent on re-run; none after reply/HOLD/suppressed/WON; `followUpMax` respected; digest email attempted to owner address only; mail XLSX + backup JSON routes return real files; backup excludes credentials.
- Browser: automation card + settings round-trip, run-followups toast, reports download buttons present, FOLLOW-UP tag visible.
- All prior tests stay green. Version → 0.4.0. Screenshots regenerated.

## Suggested next (v0.5 candidates, not built here)
- Restore from backup JSON (additive merge with dry-run preview).
- Optional Facebook/X publish connectors (owner-created apps).
- Second follow-up angle library + seasonal pause windows.
- Invoice reminders for overdue invoices (owner-email, review-gated).
