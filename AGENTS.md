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

### Step 3 — Auth + Profile + Resume Parsing ✅
**Auth.js v5 + Google**: one consent grants sign-in AND Gmail scopes (`gmail.send`/`gmail.readonly`, `access_type=offline` + `prompt=consent` → refresh token saved on the Account row — no separate "connect Gmail" step later). Database sessions (revocable) via Prisma adapter.
**Resume pipeline**: upload → text extraction (unpdf for PDF, mammoth for DOCX; detects scanned images by min text length) → Claude **structured outputs** (response is schema-constrained + Zod-validated — malformed LLM output is impossible downstream) → original stored via a swappable storage adapter (local disk now, S3 later; path-traversal guard on keys).
**Interview line:** "The LLM prompt is extraction-only — same no-fabrication rule as tailoring — and I trust the schema, not the model: structured outputs + Zod validation at the boundary."

### Step 4 — Resume Tailoring + LaTeX PDF + ATS ✅
**One LLM call, two jobs:** JD analysis + tailoring in a single structured-output request (half the cost of two round trips; the analysis grounds the tailoring).
**No-fabrication has THREE layers:** (1) hard rules in the prompt, (2) schema field descriptions, (3) a programmatic guard — any employer/institution in the output that isn't in the master profile rejects the whole result. "I don't trust the model's promise; I verify."
**LaTeX pipeline:** slot-based template (`%%EXPERIENCE%%` markers — designers edit the .tex, code fills slots) → single-pass escaping (sequential replaces would re-escape inserted braces — classic bug, avoided) → compiler adapter: local Tectonic in prod, free remote compile API on dev machines. Verified with a real PDF incl. special-char stress test.
**ATS score is explainable:** 70% JD-keyword coverage + 30% completeness checks; user sees exactly which keywords are missing (this also feeds the skill-gap feature later).

### Step 5 — Free Email Finder + YC Jobs ✅
**The "I built my own Hunter.io" story.** Pipeline: company name → domain discovery (guess candidate domains, first with DNS MX records wins) → scrape public pages for real emails → learn the company's email pattern from them → generate candidates (recruiter name × 6 patterns + careers@/hr@ fallbacks) → MX-verify → tiered confidence (careers@ found on site 95 → role fallback 40; **no MX = capped at 15** because bounces poison the user's Gmail sender reputation).
**Nuance worth telling:** found-on-site emails aren't all equal — `careers@` is the hiring channel (95) but `sales@` is real-yet-wrong-audience (45, ranked BELOW name-based guesses). Caught this in live testing against a real company.
**Honest limitation:** true mailbox verification needs SMTP RCPT-TO on port 25, which cloud hosts block — MX + pattern confidence is the zero-cost ceiling; bounce handling covers the rest.
**YC jobs:** "Ask HN: Who is Hiring" monthly thread via HN's free Algolia API — parses the "Company | Role | Location" comment convention; verified live (85 matching startup jobs).

### Step 6 — Cold Email + LinkedIn Kit ✅
**Gmail with raw REST, not the SDK:** we need exactly 2 endpoints (token refresh + send), so I skipped the ~10MB `googleapis` package and built a small client: refresh-token flow with DB persistence, hand-built RFC2822 MIME (UTF-8 subject encoding, multipart PDF attachment, In-Reply-To headers ready for threaded follow-ups).
**The retry that must NOT exist:** every other external call retries on failure — the Gmail send has `retries: 0`. An ambiguous failure (timeout after the server accepted) + retry = the recruiter gets the email twice. Idempotency > availability for sends.
**Approval-first flow:** AI drafts the whole kit in one call (email + LinkedIn note + DM, one voice); the user reviews and can edit; their edits override the draft at send time. Daily cap checked at send (RATE_LIMITED), already-sent guard (CONFLICT).
**Prompt quality detail:** the drafter has a banned-phrase list ("I hope this email finds you well", "passionate", flattery) and a hard structure: hook → 2-3 real proof points mapped to the JD → links → low-friction CTA, under 150 words.

---

## Conventions

- Repo: `https://github.com/Ankit-iiitkota/job_finder` · conventional commits (`feat:` `fix:` `docs:`) · **no co-author lines** · push after every unit of work
- Code rules: no `any`; thin routes → fat services (`src/server/`); Zod at every boundary; pino not console.log; adapters for all integrations
