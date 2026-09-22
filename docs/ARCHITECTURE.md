# Architecture and honest release scope

Browser (static HTML/CSS/JS) → owner-authenticated Worker API → private D1 records.

Google OAuth → encrypted server-side Gmail refresh token. Worker Cron → bounded Tavily discovery/queue → primary-page enrichment → owner review → draft/approval → consent-gated Gmail outbox → bounded reply matching → cohort analytics and review tasks. Previous-day snapshots are retained in D1 and converted to XLSX on an authenticated download request. No browser API keys, Google Sheet dependency, paid fallback or separate paid hosting server.

## Storage

`objects(kind,id,data,version)` stores typed records for settings, leads, drafts, jobs, reports, tasks, credits, events, credentials and suppression. This is a document-oriented pilot on D1, not a fully normalized high-scale CRM. `dedup` reserves unique company domains. `sessions` stores hashed session tokens. `leases` serializes work; pause and recipient suppression have priority paths. Gmail refresh tokens use AES-GCM with a Worker secret.

A lease prevents ordinary overlapping workers. A message becomes SENDING before its network request and becomes UNKNOWN after an ambiguous failure; it is not automatically resent. Success reconciliation uses exact generated Message-ID. Delivery to an inbox is never inferred solely from Gmail API acceptance.

## Actual feature status

| Area | This release |
|---|---|
| Web dashboard + data persistence | Implemented and locally browser-tested |
| Owner Google authentication | Implemented; owner production authorization pending |
| Broad/focused/adaptive searches | Implemented; 249 country/territory options, English-query sampling, free caps |
| Primary-site contact enrichment | Implemented heuristics; not verified recipients, diagnoses or buyer intent |
| Review, editable drafts, sending toggle | Implemented, locally tested; no real prospect sent from this workspace |
| Gmail send, suppression, opt-out, uncertain-delivery handling | Implemented; mocked external-provider/D1 tests; actual owner Gmail acceptance pending |
| Reply sync | Bounded thread matching, not a full inbox or all historical messages |
| Nurture | Review tasks, dates, drafts and opted-in send gates; no complete multi-step autonomous nurture sequence engine |
| Marketing | Daily auto-drafted content (template engine; seasonal + skill rotation + owner-recorded case notes), campaigns, rule-based marketing ideas. Posts only after approval. No paid ads, no SEO automation |
| Sales | Pipeline stages with history, quotes, win/loss reasons (LOST requires a reason), proposal-ready drafts, invoice creation on wins; no autonomous negotiation or payment collection |
| Customer success | Automatic day-1/7/30 check-in schedule on wins, welcome draft, weekly digest (Dhaka week) with overdue check-ins, satisfaction scores, invoice tasks. No external ticketing or product telemetry |
| Churn/behaviour | Recorded outcome cohorts, satisfaction trends and overdue-task signals. No predictive churn score; authorised first-party usage/payment data ingestion is not built |
| Finance | Invoices (draft/sent/paid/overdue) with paid-amount lock, outstanding/paid totals, pipeline quote value; money moves externally (bKash/bank/card), never processed in-app |
| AI | Optional anonymous suggestions plus deterministic adaptive routing. No trained personal model and no raw CRM sent to Gemini |
| Old Google Form/CRM | One-time research import only; no continuous inbound bridge yet |
| Daily XLSX | Native private downloads from immutable D1 snapshots; no Google Drive needed |

**The requested broader lifecycle system is not fully complete.** This is one integrated app release with functioning core workflows and explicit boundaries, not a claim that every integration or customer analytics feature is operational.

## Operational limits / known risks

- Configurable targeting does not create unlimited provider quota. Target 50 non-held research records/day may be missed substantially. No job post is required for a fit-only prospect.
- 8 basic search attempts/day, 20 extraction batches/day (up to 5 URLs each), 28 reserved credits/day, 900/month, plus provider free-account checks. No automatic KEYLESS fallback.
- Search slots are spread across the day. Manual runs can use remaining daily slots immediately. CPU/network/provider limits can delay or fail jobs; no paid-tier auto-upgrade.
- App has a 2,500-lead pilot cap; object reads are bounded to the latest 3,000 records per kind; activity retains the latest 200 events. Automatic long-term archival is not implemented. Export/back up and plan maintenance before capacity is reached. It is not an indefinite zero-maintenance CRM.
- Directory/site ownership recognition, country evidence, names and postal excerpts remain heuristic. Known Trustpilot/installer directories/staging pages are blocked, but unknown third-party platforms can still slip through. Primary-source status is not independently certified.
- Send reservations are row-locked in D1; the worker re-checks pause and current suppression immediately before the Gmail request, and the exact approved recipient is revalidated. In-flight network failure is uncertain, not a proof of failure. Public email alone does not activate sending. Manual reviewed-business basis is a human legal/source review, not a software declaration of compliance.
- The permission check immediately before a request cannot withdraw a message already in flight. Suppression is retained even when later bookkeeping completes.
- Failed extraction jobs require review; no infinite retries. Provider usage is checked before paid-capable requests; quotas can be shared with other apps, so leave PAYG disabled/no card as confirmed.
- Facebook/X auto-posting connectors (owner app setup), paid advertising (excluded by design), first-party event ingestion, rate-limit hardening of public OAuth endpoints, complete import-field mapping, long-term archival and OAuth/Gmail production approval remain further work. This pilot is single-owner, not a public multi-tenant SaaS.
- Optional AI cannot inspect the owner’s Google billing status; use only an unbilled approved free project. Suggestion text is untrusted and rendered as text.
