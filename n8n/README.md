# n8n Workflows

Version-controlled exports (Settings → Download in the n8n UI produces this
JSON shape; these can also be imported directly: **Workflows → Import from File**).

| File | Trigger | Calls | Purpose |
|---|---|---|---|
| `wf1-job-scanner.json` | cron, every 2h | `POST /api/jobs/scan` | FEATURES.md F2 |
| `wf2-resume-tailor.json` | webhook (app fires on application create) | `POST /:id/tailor` → `POST /:id/find-recruiter` | F3 + F4 |
| `wf4-cold-email-sender.json` | webhook (after WF2) | `POST /:id/outreach` → `POST /:id/send` (AUTO mode only) | F5 + F6 |
| `wf5-followup-engine.json` | cron, daily 9am | `POST /api/followups/run` | F7 |
| `wf6-reply-detector.json` | cron, every 15 min | `POST /api/replies/check` | F7 |

WF3 (Email Finder) is folded into WF2 — finding the recruiter is cheap and
has no reason to be a separate round trip.

## Required n8n environment variables

Set these in n8n (Settings → Variables, or container env):

```
APP_BASE_URL=https://your-app.vercel.app   # or http://localhost:3000 for local dev
N8N_CALLBACK_SECRET=<same value as the app's .env N8N_CALLBACK_SECRET>
```

## Why webhooks call the app, and cron lives in n8n

The app never runs its own schedulers — n8n owns every cron. The app only
exposes stateless, idempotent, secret-protected endpoints; n8n decides when
to call them and can be paused, retried, or inspected without touching the
app's code. See `AGENTS.md` for the fuller architecture rationale.

## Every endpoint here is safe to re-run

Job scan: DB-level `skipDuplicates`. Tailoring/find-recruiter: `upsert`.
Follow-ups: idempotency-keyed email rows. Reply detection: pure read + status
check. A workflow retrying after a transient n8n crash never corrupts state
or double-sends.
