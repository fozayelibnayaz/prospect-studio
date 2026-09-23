# Prospect Studio v0.5.0 — Plan: Portability, Money Follow-through & Pacing

Owner directive: build the full round (restore from backup, invoice reminders, second follow-up angle, seasonal pause windows).

## Scope

### 1. Restore from backup (Reports view)
- Upload the backup JSON produced by v0.4. Two-step: **Preview** (dry run, counts only, no writes) → **Restore** (explicit confirm).
- Two modes: **add missing records only** (default, never clobbers current work) and **replace existing records with the backup version** (explicit choice).
- Whitelist of restorable kinds; **credentials are never restorable** (reconnect Gmail in the app after a restore). Per-record and total caps; oversized bodies rejected. Snapshot row-detail is not restored (documented) and the XLSX route now fails safely instead of crashing on a restored metadata-only snapshot.

### 2. Invoice reminders (Finance + Automation)
- For each **overdue, unpaid** invoice (due date passed, up to 2 reminders, 7-day spacing): draft a polite reminder to that customer, tied to the invoice, on the Work board as a task.
- Review-gated like everything else: it is a DRAFT that must be approved (or auto-send under the owner's existing opt-in setting). Suppressed, held or invalid-email customers are skipped.
- When a reminder actually sends, the invoice is stamped so no duplicate/second-look spam occurs.
- New setting `invoiceRemindersOn` (default ON) + Automation row with run-now.

### 3. Second follow-up angle (distinct, final, honest)
- Touch 1 keeps the current "one more look" copy. Touch 2 is a **different** message that states plainly it is the last one and closes the file unless they say otherwise. Same rules: never after reply, hold, suppression, win or loss; max 1–2 touches.

### 4. Seasonal pause windows
- Owner-set date ranges (one per line, `YYYY-MM-DD..YYYY-MM-DD` or a single date). Inside a window, **outbound-only** work pauses: sending, follow-ups and invoice reminders. Research, reply-watch, content drafting and reporting continue (they cost nothing and hurt nobody).
- Visible status in Automation ("Outreach sending: PAUSED (window until …)") so a quiet dashboard is never a mystery.

## QA gates
- Unit: window parsing/matching/validation (incl. single date, reversed ranges, malformed lines), both follow-up angles (distinct bodies, finality wording, no invented claims), invoice-reminder copy (amount/currency/due date, no pressure), distance to knowledge (paste distance).
- Integration (real D1, mocked providers): restore dry-run writes nothing; add mode skips existing; update mode overwrites; credentials kind ignored even if present in the file; oversized/short bodies rejected; a snapshot without rows returns a clear error instead of crashing; reminders created once for overdue invoices, skipped when paid/not-due/suppressed/on-hold/already-queued/spaced/at the two-reminder cap; reminder send stamps the invoice; pause window blocks sends, follow-ups and reminders but not discovery.
- Browser: restore preview panel with a fabricated backup file; finance reminder button; automation rows for windows + invoice reminders; follow-up card saves windows.
- All prior tests stay green. Version → 0.5.0.

## Suggested next (v0.6 candidates)
- Paste-less posting prep (Facebook/X app setup walkthrough).
- Two-way reply drafting: suggest a reply text for a matched reply (review-gated).
- Lead scoring from recorded outcomes only.
- Multi-currency finance summary normalisation.
