# Prospect Studio — Whole-System Expansion Plan (v0.6 / Job Radar v1.0 / v0.7)

Owner request (2026-09-22): urgency alerts, daily Telegram for everything, prospect job-search signal, multi-language, wider research fields, a fallback mode when the 900-credit budget is spent, a **separate jobs system** (local / remote / internships / visa sponsorship, CV-based, auto-apply, replies, progress), plus features a brand-new business owner needs — "from starting to a converted lead", the whole thing at once.

Deliverables in this round:
1. **Prospect Studio v0.6.0** — urgency alerts, daily Telegram digest, multi-language, research expansion, fallback chain, prospect-side hiring signal.
2. **Job Radar v1.0.0** — a **separate app** (own Worker + D1 + URL) for finding and applying to jobs.
3. **Prospect Studio v0.7.0** — entrepreneur suite (launch plan, goals, first-customers playbook, business health).
Shipped as two ZIPs: `prospect-studio-v0.7.0-source.zip` (contains v0.6 + v0.7) and `job-radar-v1.0.0-source.zip`.

---

## 1. Urgent reply alerts ("Call now" / "urgent to contact")

**How it works (free-tier legal, verified):** Cloudflare allows a **1-minute cron trigger** on the free plan (minimum granularity is 1 minute; 3 triggers per worker on free, we use 2). So the worker gains a second schedule, `* * * * *`, whose handler does one light job: read the last few inbox messages, match them to your sent threads, classify urgency, and alert you. Latency: **under ~60 seconds** from the reply landing. No Google Cloud / Pub/Sub / billing account is needed (that path needs a GCP project and a public webhook — we avoid it).

**Classification (two layers, honest):**
- **Rules (always on, free):** urgent phrases the owner can edit — call now, call me, please call, urgent, asap, immediately, time-sensitive, "today", "before", deadline, meeting request, phone-number present, "ready to pay / sign / contract". Tiered: URGENT / HIGH / NORMAL.
- **Optional AI layer:** Gemini reads **only the matched reply** (never the inbox, never contacts) to catch phrasing the rules miss, and returns urgent / not-urgent plus one line of why. Requires its own explicit owner confirmation flag and can be switched off; rules keep working without it.

**What you get on an urgent match:** instant Telegram message, instant email to your own address, the reply flagged **URGENT** in Email activity (full text already stored), a "Call back — urgent reply" task on the Work board, and a red banner on Overview until you mark it handled. Optional toggle: watch the **whole inbox** (not just threads you sent) — useful later for job replies.

## 2. Daily Telegram for everything

One scheduled message at ~00:05 Dhaka: new prospects discovered (and by which source), messages sent, replies received, urgent items still unhandled, content drafted/posted, tasks due/overdue, invoices overdue and paid, jobs found/shortlisted/applied (from Job Radar), and what the worker will do next. Plus the existing weekly digest (Telegram + owner email). If Telegram is disconnected, the same summary is emailed instead.

## 3. Multi-language

- **Interface:** English + **বাংলা (Bangla)** with a language switch in Settings; all new strings in one dictionary file, structure ready for more languages later.
- **Outreach & marketing templates:** EN + BN built in. A prospect's language can be set per lead (Bangla for BD prospects, English otherwise by default).
- **Optional AI translation** (owner-confirmed) for other languages; without AI the app always falls back to the two built-in templates — never a blank or a machine-garbled message.
- Job Radar: EN + BN interface; CV and application letters in the language you choose per application.

## 4. Wider research fields & better prospects

New free sources added to discovery (both keyless or free-key):
- **OpenStreetMap Overpass API** — real local businesses with a website/phone, by city and category, free, no key, commercial use allowed with attribution ("© OpenStreetMap contributors"). This is the strongest addition for "local business" prospects.
- **Google Programmable Search** — 100 searches/day free, no card, needs a free API key + search engine ID that the owner creates (2-minute setup). Used as the fallback search engine.

New fields captured and scored on each lead (all from public pages, no guessing):
- **Platform** (WordPress / Shopify / Wix / Squarespace / custom / unknown) — a direct buying signal for your services.
- **Analytics present** (GA4 / GTM / none detected).
- **Social profiles** found on the site (LinkedIn / Facebook / Instagram / X).
- **Hiring signal** — the company appears on a job board or ATS feed covered by Job Radar (companies hiring usually need contractors).
- **Site language**, city/region, phone, review count/rating where the source provides them.
- **Fit score (0–100, transparent and explainable)** — each point is listed ("no analytics found +15, hiring +20, Wix +10…"). Labeled a *fit heuristic*, never buying intent.

## 5. Fallback mode when the 900-credit budget is spent

Automatic chain, no owner action needed:
1. **Tavily** (primary) — used until the monthly reserved 900 credits are gone.
2. **Google Programmable Search** (free 100/day) — takes over automatically.
3. **OpenStreetMap local-business mode** — needs no key at all; always available as the last resort.
4. **Job-signal prospecting** — companies hiring on Job Radar feeds become prospects.

Automation shows which mode is active ("Fallback active: OpenStreetMap local mode — Tavily monthly budget spent") and Telegram is told the moment a switch happens. Research never silently dies.

## 6. Job Radar v1.0 — the separate jobs system

**Separate app**, own Worker (`ayaz-job-radar`), own D1, own URL, same Cloudflare account, same owner-only Google login. One-time owner setup: add one redirect URL to the existing Google OAuth client (2 minutes, free).

**Sources (all free, verified keyless or free-key):** Remotive, Arbeitnow, RemoteOK, Jobicy, Himalayas, We Work Remotely (RSS), **Hacker News "Who is hiring" via the free Algolia API** (this is where visa-sponsorship language actually appears), plus **direct ATS feeds** — Greenhouse, Lever, Ashby, Workable, SmartRecruiters, Personio (public JSON, no auth) for a company list you can extend yourself.
Honest limits: LinkedIn/Indeed/Glassdoor have no free API and are not scraped; "visa sponsorship" is detected from the posting text and is always shown as *the posting's own words*, never a promise.

**Your side (profile):**
- Name, headline, skills/tags, experience summary, languages, target roles (free text, e.g. "web development", "data analysis", "WordPress"), locations + remote-only, seniority, salary floor, **visa sponsorship required** switch, internships included switch, posted-within-N-days.
- **CV upload** (PDF/DOCX up to 2 MB, stored encrypted-at-rest in D1, downloadable only by you) with multiple versions (e.g. "developer CV", "analyst CV") and a cover-letter template per version.

**The flow:** search input → matched jobs (score + why) → shortlist → application draft (your CV attached, tailored opening paragraph) → **review and send, or let auto-apply do it** → replies tracked automatically → pipeline stages (FOUND → SHORTLISTED → DRAFTED → APPLIED → REPLY → INTERVIEW → OFFER → REJECTED) → progress charts and an export.
- **Auto-apply** (your choice of mode): *Review-gated* (default; you approve each) or *Automatic* — sends only where the posting invites email applications, max N/day (default 5), never the same company twice, and always logged. Every application is visible in one place with its reply status.
- **Follow-up:** one polite nudge after 5 days with no reply, then stop (same discipline as the prospect system).
- **Daily Telegram:** new matches that fit your profile, applications sent, replies received.
- Multi-language: EN + BN, and job postings are stored in their original language with an optional one-line AI summary.

## 7. Entrepreneur suite (v0.7, same app) — for a brand-new owner

- **Launch plan generator:** answer five quick questions (what you sell, to whom, price, time available, city/market) → the app creates a **30-day plan**: offer & pricing, one clear service page, portfolio proof, first-10-customers campaign, tracking setup, invoicing, testimonials. Every item becomes a real task/campaign/draft in the app, not a PDF.
- **Goals & pace:** monthly revenue and customer targets with progress from your recorded invoices/wins, and a weekly pace line ("you are 3 days behind this month's pace").
- **First-customers playbook:** 20 outreach angles + 10 content starters (EN/BN), each one-click convertible into a campaign or a draft.
- **Business health check (weekly):** unanswered conversations, overdue invoices, quiet pipeline, nothing posted, tasks piling up — with the single next best action.
- **Journey view:** start → first outreach → first reply → first proposal → first won customer → delivery → renewal, with your own numbers at each stage.

---

## Build order, QA and delivery

1. Prospect Studio v0.6 (alerts, digest, language, research, fallback) → unit + integration + browser tests → screenshots.
2. Job Radar v1.0 (sources, profile/CV, matching, apply, replies, pipeline) → its own test suite (source adapters mocked, D1 integration, browser flows).
3. Prospect Studio v0.7 (entrepreneur suite) → tests extended.
4. Full regression on both apps, docs updated (QA.md, ARCHITECTURE.md, DEPLOY.md, README), two ZIPs + one deploy sheet.

Honest notes: the 1-minute alert cron must stay tiny (free plan allows 10 ms CPU and 50 sub-fetches per run) — the design keeps it to a handful of calls. Auto-apply sends real applications from your Gmail; the default is review-gated for exactly that reason. Visa-sponsorship and fit scores are heuristic labels, never guarantees.
