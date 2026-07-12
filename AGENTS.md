<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# AI Job Finder — Interview Prep Notes

> Lean notes for explaining this project in interviews. Full feature spec, architecture diagram, and the phase-by-phase plan live in **`FEATURES.md`**. Update this file whenever something meaningful is built — short entries only.

---

## The Pitch

**One-liner:** *"I built a full-stack platform that automates the entire job application pipeline — from job discovery to personalized outreach to follow-up tracking — using Next.js for the product and n8n for automation workflows, with an LLM doing resume tailoring and email personalization, and a zero-cost email-discovery pipeline I engineered myself instead of paying for Hunter/Apollo."*

**Flow in one breath:** upload resume → platform finds fresh jobs (free APIs) → tailors resume per JD (LaTeX PDF, ATS-optimized) → finds recruiter email (free pattern+MX pipeline) → sends personalized cold email from the user's own Gmail → LinkedIn message for manual sending → auto follow-up after 7 days → dashboard tracks everything.

## Tech Stack (and the "why" for each)

- **Next.js 16 + TypeScript** — one codebase for UI + API, App Router, type safety
- **PostgreSQL + Prisma 7** — relational fit (users→jobs→applications→emails); DB-level constraints do real work (dedupe, idempotency)
- **n8n (self-hosted)** — orchestrates scraping/LLM/email schedules OUTSIDE the web request cycle; visual debugging, retries
- **Claude API** — resume parsing/tailoring, email drafting (only paid dependency, isolated behind `lib/ai/` so it's swappable)
- **LaTeX (Tectonic)** — ATS-safe resume PDFs
- **Gmail API** — send from user's own inbox (deliverability + authenticity), detect replies

## Key Engineering Decisions (interview gold)

1. **Free email-finder instead of paid API** — scrape company site → learn email pattern → generate candidates → DNS MX verify → confidence score. Better story than "I called Hunter.io".
2. **Adapter pattern for job sources** — every source implements `JobSourceAdapter`; adding a source = one new file. One source failing never kills a scan (`Promise.allSettled`).
3. **DB-level guarantees** — `@@unique([source, externalId])` = a job can never duplicate; `idempotencyKey @unique` on emails = an n8n retry can never double-send.
4. **Fail-fast env** — Zod parses `process.env` at boot; missing var = readable crash at startup, not mystery at runtime.
5. **Consistent errors** — one `AppError` class + `apiHandler()` wrapper → every API returns `{ error: { code, message } }`, no leaked stack traces.
6. **Resilient external calls** — `safeFetch()`: hard timeout (AbortController), retry with exponential backoff + jitter on 429/5xx, per-host politeness delay.
7. **Webhooks both directions** — app triggers n8n workflows; n8n calls back with a shared-secret header; DB is the single source of truth.
8. **Prisma 7 breaking changes handled** — url moved to `prisma.config.ts`, TS client generated into src (gitignored, `postinstall` regenerates), pg driver adapter. "I read release notes instead of pasting outdated tutorials."
9. **No fabrication rule** — LLM may only reorder/rephrase real experience; structured JSON output validated against the master profile.
10. **LinkedIn stays manual** — automation violates LinkedIn ToS (account bans); we generate the message, the user sends it.

## Q&A Cheat Sheet

**Why n8n instead of your own cron/queues?** Faster iteration on multi-step integrations, built-in retries, visual debugging of runs, credential store. Business logic stays in TypeScript services — n8n only orchestrates. At scale I'd move hot paths to BullMQ workers.

**How do you get a high ATS score?** ATS = keyword matching + parseable structure. (1) LLM works JD keywords naturally into real bullets, (2) LaTeX template is ATS-safe (standard headings, no tables/columns/images), (3) we compute keyword coverage ourselves and show it.

**How do you avoid spam filters?** User's own Gmail, ~20/day cap with random delays, MX-verified recipients (fewer bounces), unique personalized content, max 2 follow-ups.

**Biggest challenges?** (1) Source reliability → adapter pattern + official APIs; (2) email accuracy → confidence scores + MX verification; (3) LLM faithfulness → strict prompts + schema-validated output; (4) async coordination → two-way webhooks, DB as source of truth, idempotency keys.

**At scale?** Dedicated scraping workers + proxies, BullMQ/Redis queues, separate LaTeX compile service, encrypted token storage, per-tenant rate limits.

---

## Build Progress Log

### Step 1 — Foundation ✅
Next.js 16 scaffold, Prisma 7 schema (8 tables, dedupe + idempotency constraints), core lib (`env.ts`, `db.ts`, `logger.ts`, `errors.ts`, `http.ts`), docker-compose (Postgres + n8n). Details in decisions 3–8 above.

### Step 2 — Job Discovery Engine ✅
`JobSourceAdapter` interface; RemoteOK / Remotive / Arbeitnow adapters (free public APIs, zero keys); scan service with `Promise.allSettled` + freshness filter (72h) + DB upsert dedupe; `POST /api/jobs/scan` (secret-protected — n8n calls it) and `GET /api/jobs` (search/filter/pagination); explainable match scoring (title×3 / tags×2 / description×1 keyword weights → 0-100).

---

## Conventions

- Repo: `https://github.com/Ankit-iiitkota/job_finder` · conventional commits (`feat:` `fix:` `docs:`) · **no co-author lines** · push after every unit of work
- Code rules: no `any`; thin routes → fat services (`src/server/`); Zod at every boundary; pino not console.log; adapters for all integrations
