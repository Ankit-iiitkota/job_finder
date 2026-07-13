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
- **Google Gemini (free tier)** — resume parsing/tailoring, email drafting; zero paid dependencies in the whole project (originally Claude — see Step 10, swapped behind `lib/ai/` without touching any prompt or schema)
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
**Resume pipeline**: upload → text extraction (unpdf for PDF, mammoth for DOCX; detects scanned images by min text length) → **structured outputs** (response is schema-constrained + Zod-validated — malformed LLM output is impossible downstream) → original stored via a swappable storage adapter (local disk now, S3 later; path-traversal guard on keys).
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

### Step 7 — Tracker + Follow-ups + Reply Detection + n8n ✅
**Follow-ups are templates, not AI** — a deliberate choice, and a good one to defend: a bump email is formulaic by nature, so a template costs zero tokens and can't hallucinate. AI earns its keep on the first email (needs real personalization); follow-ups don't.
**Idempotent by construction:** the follow-up email row is created with `sentAt: null` BEFORE the Gmail call, keyed by `applicationId:FOLLOWUP_1`. If the process crashes between create and send, the next cron run finds a resumable row instead of creating a duplicate — same pattern that makes the whole system retry-safe.
**Reply detection cancels the ladder:** polls Gmail threads for sent-but-unanswered emails; any thread message not from the user is a reply → `repliedAt` stamped, unsent follow-up rows **deleted** (never bump someone who already answered), status → REPLIED. Grouped per user so each user's Gmail token is fetched once, not once per email.
**n8n workflows live in the repo, not just the n8n UI** — `n8n/workflows/*.json`, importable and diffable. Cron ownership is 100% n8n's job; the app only exposes stateless, secret-protected, idempotent endpoints. This split is the answer to "why n8n and not your own scheduler."

### Step 8 — Dashboard ✅
**Services power both server-rendered pages AND API routes** — `listJobs`/`listApplications`/`getApplicationDetail` live in `src/server/services/`; the jobs/applications/detail pages call them directly (server component → straight DB read, zero network hop), while the matching API routes call the *same* function for client-side fetches after a mutation. One implementation, two callers, impossible to drift out of sync.
**The detail page IS the approval screen** — tailor → find recruiter → AI-draft → edit → send → copy LinkedIn, all on one page, each action refetching the full record afterward so the UI never holds stale derived state. Simpler than hand-rolled optimistic updates, correct by construction.
**Progressive enhancement where it's free** — the job filters are a plain `<form method="get">`; filtering works even with JS disabled, and the URL is shareable/bookmarkable. Only truly interactive things (Apply, Tailor, Send, Copy) are client components.

### Step 9 — Production Polish ✅ (final phase — all 9 phases complete)
**Token encryption at exactly two boundaries.** Gmail OAuth tokens are AES-256-GCM encrypted at rest. Rather than encrypting/decrypting scattered across the codebase, I found the two places that actually touch tokens — the Auth.js adapter's `linkAccount` (write, on sign-in) and `getGmailAccessToken` (read + refresh-write) — and wrapped only those. An `isEncrypted()` guard makes it a safe rollout with no migration script: legacy plaintext rows still decrypt-passthrough correctly.
**Cost guard is a reused table, not a new one.** `assertAiCallBudget` caps LLM-triggering actions per user/day by counting rows already written to the audit-log table from Phase 4/7 — same principle as everywhere else in this project: don't add infrastructure a feature can borrow from an existing one.
**Skill-gap and A/B testing both cost zero extra AI calls** — skill-gap re-reads `jdAnalysis` already stored on every tailored application; A/B variant assignment is a deterministic hash of the application id (no experiments table, stable across redrafts).
**Deployment story ties back to a Phase-4 decision.** The Dockerfile ships without a LaTeX binary on purpose — the local/remote compiler auto-detection built in Phase 4 means Vercel serverless (no Tectonic) and a VM (with Tectonic) run the identical code path with zero branching. Designing for graceful degradation early paid off at deploy time.

**Live DB hardening — a real debugging story.** Wiring up Neon surfaced intermittent `ETIMEDOUT` on the first query after any idle gap. Before writing a fix I gathered evidence instead of guessing: a raw TCP connect loop (10/10 succeeded, ~275ms each) proved the network path was fine, which ruled out "bad internet/ISP" and pointed at the Postgres/pool layer instead — most likely Neon's free-tier compute autosuspending and leaving a pool connection that looks alive but isn't. Fix: (1) `dns.setDefaultResultOrder("ipv4first")` — Node can pick a slow/broken AAAA record over a fine A record, a known class of intermittent cloud-DB timeout; (2) a Prisma Client extension (`$allOperations`) that retries transient errors (`ETIMEDOUT`, `P1001/P1002/P1008/P1017`) with backoff — the exact same resilience pattern `safeFetch` already applies to HTTP, now applied at the query layer too. Net effect: a live server's persistent pool stays reliable under real traffic (verified: 3/3 clean requests once warm); the residual flakiness only shows up on a cold first connection after an idle gap, which is inherent to serverless Postgres free tiers and fades under continuous traffic. **The lesson, not just the fix:** get hard evidence (the TCP test) before reaching for a fix — "add a retry" is the right call here specifically because the diagnosis ruled out the alternatives first.

### Step 10 — Swapped Claude for Gemini (zero paid dependencies) ✅
**The provider boundary paid off exactly as designed.** `lib/ai/` was built in Step 3 specifically so the LLM could be swapped without touching business logic — this was the first time that bet got tested for real, and it held: swapping providers touched `lib/ai/client.ts` (rewritten) and three call sites (one-line changes each). Zero changes to any Zod schema, any prompt's business rules, or any service in `server/services/`.
**Technical core of the swap:** Gemini's `responseJsonSchema` config field accepts real JSON Schema (not the older restricted OpenAPI-3.0 subset `responseSchema` uses) — so `z.toJSONSchema(schema)` (Zod v4's **native**, no-extra-dependency JSON Schema export) plugs straight in. Verified the exact field support by reading the installed SDK's `.d.ts` directly rather than trusting training-data memory of an API that changes often.
**Defense-in-depth kept**: Gemini's structured output makes malformed JSON unlikely, not impossible, so the parsed result is Zod-`safeParse`d again after the API call — same "trust the schema, not the model" principle as the original Claude integration.
**A real bug found and fixed en route**: `.env`'s `KEY=""` convention for "not set yet" crashed the app at boot — Zod's `.optional()` only treats `undefined` as absent, not empty string, so `LATEX_COMPILER=""` failed enum validation. Fixed once in the env loader (normalize `""` → `undefined` before parsing) rather than special-casing every field.

### Step 11 — Adzuna source + two more real bugs shaken out by live credentials ✅
**"invalid_client" was a truncated copy-paste, not a config mistake.** The Google OAuth client ID pasted into `.env` early on was missing its leading 3 digits (`214598214-...` instead of `284214598214-...`) — a silent truncation somewhere upstream of the terminal. Confirmed by diffing against the official downloaded credentials JSON, not by guessing at consent-screen settings. Lesson: when a credential "doesn't work," diff it character-for-character against the source before touching any config.
**Found a bug in my OWN previous fix.** Step 10's Neon IPv6 fix (`dns.setDefaultResultOrder("ipv4first")`) lived inside `db.ts`, so it only ran in processes that imported the Prisma client — plain `fetch()` calls elsewhere (job adapters) never got it. Adding Adzuna exposed the gap immediately (same IPv6-unreachable symptom, different host). Moved the fix to `env.ts`, the one module every server code path imports first. **Lesson:** a process-wide side effect belongs in the module everything shares, not the module that happened to need it first.
**Then found a THIRD issue that isn't a code bug at all**: even with the DNS fix, Node (fetch *and* the raw `https` module) couldn't reach Adzuna's IPs on this machine — `ETIMEDOUT` on every IPv4 address — while `curl` to the identical URL succeeded instantly, and the same Node `fetch()` code path worked fine for every *other* job source in the same test run. That combination (curl fine, other Node-fetch destinations fine, only this one host blocked for Node) points at local security software doing per-destination/per-process filtering, not a code or network-routing problem. Verified the adapter itself is correct by matching its parsing against `curl`'s real response JSON directly. **Lesson: know when a symptom stops being your bug** — three tests (curl control, cross-source control, raw-module control) isolated the variable to "this machine's Node process, this one host" before I stopped chasing it.
**Proof the resilience design earns its keep**: triggered a real scan with Adzuna in this broken state — `Promise.allSettled` (Phase 2) caught the failure, reported it in `bySource.ADZUNA.error`, and the other 4 sources completed normally. The architecture decision from Phase 2 was validated by an unplanned real failure, not just a unit test.

### Step 12 — Gemini key testing exposed a real error-handling gap ✅
Plugging in a real Gemini key immediately surfaced two account-level facts (not code bugs): the hardcoded default model `gemini-2.5-flash` is dead for new API keys (clean 404 "no longer available to new users" — fixed default to the `gemini-flash-latest` alias, which tracks Google's current model instead of a pinned name that ages out), and this specific key's project has a **zero** free-tier quota for the standard models (`limit: 0` in the 429 response — a provisioning gap on the Google Cloud project, not a "used up" quota).
**The valuable finding wasn't the quota — it was what testing against it revealed**: `generateStructured()` had zero error handling around the actual API call. A 503/429 from Gemini was thrown as a raw SDK `ApiError` straight through `apiHandler`, which the code hadn't accounted for — the exact "raw exception leaks to the client" failure mode rule 5 (AGENTS.md conventions) exists to prevent. Fixed with a `toAppError()` mapper (429→`RATE_LIMITED`, 503→`UPSTREAM_ERROR` with a friendly message, 401/403→`INTERNAL`) plus a short retry-with-backoff on 503 specifically, mirroring the same transient-vs-permanent distinction already used in `safeFetch` and the Prisma retry extension. **A failing test run that never got a clean success was still worth the tool calls** — it found a bug no success path would have.

---

## Conventions

- Repo: `https://github.com/Ankit-iiitkota/job_finder` · conventional commits (`feat:` `fix:` `docs:`) · **no co-author lines** · push after every unit of work
- Code rules: no `any`; thin routes → fat services (`src/server/`); Zod at every boundary; pino not console.log; adapters for all integrations
