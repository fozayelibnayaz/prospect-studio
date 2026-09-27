# PLAN v0.6 → v0.7 → Job Radar v1.0 — delivered

Written as the build record for the round the owner approved on 2026-09-22
("complete the whole system at once … build, qa, finalize, share").

## What shipped in this round

### Prospect Studio v0.6 — reach and reliability
1. **Urgent reply alerts** — free 1-minute Cloudflare cron, rules layer always on, optional AI second
   opinion on the single matched reply only, instant Telegram + owner email + URGENT flag + call-back
   task + Overview banner, manual "Check now" button. Optional whole-inbox watch (off by default).
2. **Daily Telegram summary** — every night ~00:05 Dhaka, all-in-one, owner-email fallback;
   weekly business health check stored and pushed on Sundays.
3. **Multi-language** — English + Bangla workspace, per-lead reply language, bilingual templates with
   deterministic fallback, optional AI translation behind the confirmed-free AI gate.
4. **Deeper research** — platform, analytics, socials, hiring signal and page language from the
   prospect's own site; transparent 0–100 fit score with listed reasons.
5. **Fallback discovery chain** — Tavily (900 free credits) → Google Programmable Search (free 100/day)
   → OpenStreetMap local mode (keyless, ODbL, attribution kept). Zero-credit extraction, visible mode,
   logged switches, Telegram notices.

### Prospect Studio v0.7 — entrepreneur suite
6. 30-day launch plan from five owner answers → dated tasks on the Work board.
7. Goals & pace — monthly revenue and new-customer targets with pro-rata expectation and a pace bar.
8. First-customers playbook (10 steps) + content starters (5 ideas), bilingual, one-click to
   tasks/drafts.
9. Weekly business health check — money and unanswered conversations first.
10. Journey view — discovered → reviewed → contacted → replied → proposal → customer → invoiced → paid,
    counted only from stored records.

### Job Radar v1.0 — the second app
11. Separate Worker (`ayaz-job-radar`), own D1 and URL, same Cloudflare account and Google client
    (one extra redirect URL).
12. Free keyless job sources: Remotive, Arbeitnow, RemoteOK, Jobicy, Himalayas, We Work Remotely RSS,
    Hacker News "Who is hiring", plus owner-supplied ATS boards (Greenhouse, Lever, Ashby, Workable,
    SmartRecruiters, Personio). LinkedIn / Indeed / Glassdoor excluded — no free API.
13. Profile + CV upload (PDF/DOCX/TXT ≤2 MB, stored in the owner's D1, excluded from backups).
14. Search "web development" / "data analysis" / anything → transparent score with reasons → shortlist.
15. Draft with CV → **review-gated by default**; optional auto-apply (max 5/day, never the same company
    twice, only where the posting shows a public application email, minimum score respected).
16. Pipeline `FOUND → SHORTLISTED → DRAFTED → APPLIED → REPLY → INTERVIEW → OFFER → REJECTED`;
    one polite follow-up after 5 days; replies auto-matched and stored with their full text.
17. Visa sponsorship flag from the posting's own words only (mentioned / no sponsorship / not mentioned).
18. Daily Telegram summary, English + Bangla, demo mode, backup export.

## Hard rules that shaped the build
- `AI_FREE_CONFIRMED` and `TAVILY_PAYGO_DISABLED_CONFIRMED` stay `"true"`; both deploy checks block
  otherwise. No card, no pay-as-you-go, no paid hosting.
- Nothing is sent (Prospect Studio or Job Radar) without the owner's approval path; autopilots are
  opt-in and bounded.
- Public data is never described as permission, intent or demand. The visa flag quotes the posting.
- Every job keeps its source name and original URL; feeds are read, never republished as our own list.

## Test evidence for this round
| Suite | Count | Command |
| --- | --- | --- |
| Prospect Studio Node | 99 | `npm test` |
| Prospect Studio browser | 31 | `npm run test:browser` |
| Job Radar Node | 24 | `npm test` (in `job-radar/`) |
| Job Radar browser | 13 | `npm run test:browser` (in `job-radar/`) |
| **Total** | **167** | |

Details, defects found and what is *not* claimed live: `docs/QA.md` (Prospect Studio) and
`job-radar/docs/QA.md`.
