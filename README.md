# Prospect Studio — integrated web-app pilot

A separate **Cloudflare Workers + D1** project for Fozayel Ibn Ayaz. No Google Sheet is required for the new app’s normal operation. This does not modify MealKhata.

**Local integrated build, not yet deployed to the owner’s Cloudflare account.** Production starts paused, automatic sending off, and credentials unconfigured. The live preview is explicitly fictional, unauthenticated demo data; it cannot make discovery, AI or Gmail calls. Never put private data in that preview.

## Start here

- [One-time owner deployment](docs/DEPLOY.md)
- [QA evidence and remaining acceptance](docs/QA.md)
- [Architecture and limits](docs/ARCHITECTURE.md)

## Included

- Eleven web-app sections: overview, prospects, review/send, pipeline, customers, marketing, finance, work/follow-ups, reports/learning, business map, settings.
- Owner-only Google OAuth login, encrypted Gmail refresh token, expiring server sessions and origin checks.
- Tavily basic search/extraction; provider free-plan preflight; local daily/monthly reservations; known directory/review-site rejection; source-backed fields; domain deduplication; explicit holds and unknowns.
- 249 country/territory options. Broad sampling rotates countries and five prospect types. Focused mode uses selected countries/types. Adaptive mode uses eligible reply cohorts and retains exploration.
- New businesses, established businesses, agencies, freelancers and public work-request search hypotheses. Job advertisements are not required. Source type, location, age and demand remain unverified until reviewed.
- Immutable daily snapshots, private authenticated XLSX downloads, optional Telegram report notice.
- Editable drafts; per-message approval; automatic sending only for recorded opt-in; mandatory contact-basis evidence; global pause; suppression/unsubscribe; daily send-attempt cap; no blind retry after uncertain delivery.
- Marketing center: daily auto-drafted posts (LinkedIn/Facebook/X channels), per-post approval, post metrics, organic campaigns, rule-based marketing ideas.
- Sales completion: quotes, stage history, win/loss reasons, invoice suggestion on wins.
- Customer success: automatic day-1/7/30 check-in schedule, welcome draft, weekly Dhaka-week digest, satisfaction scores.
- Finance: invoice records with paid-lock, collected/outstanding totals, pipeline value.
- Gmail reply matching against sent thread IDs, sender addresses and contact dates; bounded inbox polling; owner-recorded external outcomes.
- Sales stages, review/follow-up/customer service tasks, automatic follow-up review task after a send, and an onboarding task when a lead is marked won.
- Anonymous weekly AI advice when independently configured on a confirmed unbilled Gemini project. No search grounding or raw CRM data is submitted.
- One-time CSV/JSON research import, without automatically granting consent or fabricating past results.

## Important limits

This is **not exhaustive global research, a guaranteed 50 buyers/day, unrestricted cold-mail automation or a finished enterprise lifecycle suite**. Read the explicit partial/unimplemented list in `docs/ARCHITECTURE.md`.

The Workers clock is configured every 15 minutes, around the clock. Scheduled search slots are spread about every 3 hours; at most eight basic searches/day. Enrichment is queued between them within its own cap. A global rotation with 249 locations therefore takes at least 32 days for even one query per location, before considering different sectors/types. English queries are used; this is not multilingual exhaustive coverage.

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
