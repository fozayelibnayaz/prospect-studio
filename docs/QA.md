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
