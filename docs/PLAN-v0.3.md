# Prospect Studio v0.3.0 — Plan: Visibility & Autopilot

Owner ask (2026-09-22):
1. No place to see **which email was sent, which was received, and what the reply said**.
2. Marketing content should **auto-generate daily**, with **topic / topic-ID input**, **quantity control**, a **manual "share a concept" path** to write more or update a post. "All customizing, please."
3. Apply the same **auto + manual + customizable** pattern to **all other categories and fields**.
4. Make it feel like a **complete business SaaS you only oversee** — 100% automated work, human supervises.
5. Loop: think → plan → build → QA feedback → check → finalize → suggest → build again.

Context confirmed in code before planning:
- Sent messages already exist on drafts (`SENT` + `gmailId`/`threadId`/`sentAt` + full body) — the outbox is derivable, no data loss.
- `syncReplies()` (cron, hourly) already matches inbox threads to sent drafts but stores only a 300-char snippet on the lead, first reply only, no per-message record.
- `generateContent()` is template-based, fixed 2–4 items/day, no topics, no quantity, no concepts, no update path.
- Settings are validated field-by-field in `validSettings()`; schema is a single EAV `objects` table, so new record kinds need no migration.

## v0.3.0 scope (built in this release)

### 1. Email activity view (the "email field")
- New sidebar view **Email activity** between Review & send and Sales pipeline.
- Merges **sent** (drafts with status SENT; SIMULATED in demo) and **received replies** (new `mail` records).
- Each row: direction badge (→ SENT / ← REPLY), business + email, subject, time, snippet. Row opens a modal with the **full message body**, sender/recipient, and a link to the lead review.
- Filters: All / Sent / Received. Counters for each.
- Backend: `syncReplies` now fetches the full message (`format=full`), extracts plain text (multipart-aware, base64url, HTML-stripped fallback), stores it as `mail` records (deduped by Gmail id, capped at 500). Skips the owner's own address and auto-submitted messages. Leads still get first-reply `replyAt`/`REPLIED` as before.

### 2. Marketing autopilot (topics + quantity + concepts + updates)
- New settings: `contentTopics` (one topic per line; optional `ID: topic` form), `contentCount` (1–10 posts/day, default 3), `contentAi` (opt-in; only active when Gemini connected AND free tier confirmed), `autoReplyWatch` (on by default).
- Daily autopilot (existing 15-min worker): when topics are set, writes exactly `contentCount` drafts per day, rotating topics and channels (LinkedIn / Facebook / X) deterministically. No topics → previous template behavior (unchanged, backward compatible).
- **Write from concept**: any text (a topic, a topic ID, a loose idea, 5–500 chars) → a new draft post for the chosen channel.
- **Update a post**: any existing post can be rewritten from new instructions (3–300 chars); version bumps, status returns to DRAFT — nothing is posted silently.
- AI path (when enabled + connected + confirmed): Gemini writes the post; any failure falls back to the honest template writer, logged. Never blocks the owner.
- All drafts still require approve → mark posted. Metrics recording unchanged.

### 3. Automation overview (the "100% automated — just oversee" screen)
- New sidebar view **Automation**: one row per autopilot — Discovery, Outreach sending, Reply watch, Daily content, Reports & digest, AI assist, Compliance guards.
- Each row: what it does, live ON/OFF state, last run, and the quick action that runs it now (Run discovery / Process one eligible message / Sync now / Generate today's content / Create snapshot / Ask AI).
- Compliance guards row is always on and visible: suppression list, per-message unsubscribe link, individual approval gate, daily caps.

### 4. Overview "needs attention" strip
- Chips on Overview for anything that needs the owner's eyes: approved messages awaiting send, content drafts to review, replies to answer, uncertain sends to reconcile, overdue tasks. Each chip links to the right view.

### 5. Docs & delivery
- This plan; QA results appended; v0.4+ suggestions.

## QA gates
- Unit: topic parsing, deterministic rotation, count control, concept writer, settings validation, legacy path unchanged.
- Integration (real D1 + mocked providers): full-body reply storage + dedupe + lead linkage; reply-watch off skips sync; concept draft; post update bumps version + resets DRAFT; settings round-trip; state exposes mail.
- Browser (Playwright, demo mode): email view rows + full-body modal; automation view; marketing autopilot card + concept write; overview attention strip.
- All prior tests must stay green. Screenshots regenerated.

## Suggested next (v0.4+, not built here)
- Follow-up sequence: day-4 nudge draft for unanswered replies (review-gated, one touch, then stop).
- Weekly email digest delivered to the owner's own Gmail (no Telegram needed).
- Lead scoring from recorded outcomes only (observational label kept).
- Email activity XLSX export; full backup/restore export.
- Optional Facebook/X publish connectors (owner-supplied apps, later).
- Team/second-user access only after a real need appears (stays single-owner for now).
