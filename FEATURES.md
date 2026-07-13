# AI Job Finder — Features, Architecture & Phase Plan

> Full product + technical spec. For interview prep notes see `AGENTS.md`.

---

## 1. Product Summary

An AI-powered job application autopilot: upload your resume once → the platform finds fresh jobs matching your skills, tailors your resume per job (ATS-optimized, LaTeX PDF), finds the recruiter/HR/founder email (free pipeline), sends a personalized cold email (resume + portfolio + GitHub links), gives you a LinkedIn message to send manually, auto-follows-up after 7 days, and tracks everything on a dashboard.

---

## 2. Core Features

| # | Feature | Description |
|---|---|---|
| F1 | **Resume Upload & Parsing** | PDF/DOCX upload → LLM extracts skills/experience/education/projects into structured JSON → user reviews/edits → becomes the "master profile" |
| F2 | **Job Discovery** | n8n cron (every 2h) fetches jobs from free APIs → dedupe → freshness filter (<72h) → match score vs user skills → DB |
| F3 | **ATS Resume Tailoring** | LLM reads JD → reorders skills, rephrases bullets with JD keywords (NEVER invents facts) → fills LaTeX template → PDF + ATS score estimate |
| F4 | **Recruiter Email Finding** | 100% free pipeline: site scrape → pattern discovery → candidate generation → DNS MX verification → confidence score (see §4) |
| F5 | **Cold Email Sending** | LLM drafts personalized email (hook + proof + resume/portfolio/GitHub links + CTA) → sent from user's own Gmail → approval mode default |
| F6 | **LinkedIn Message Generator** | Connection note + DM generated; user sends manually (LinkedIn automation = ToS ban risk) |
| F7 | **Tracker + Auto Follow-up** | Status pipeline per application; no reply in 7 days → auto follow-up (max 2); Gmail inbox watched for replies |
| F8 | **Dashboard** | Jobs found, applications kanban/table, resumes, emails, follow-ups, response-rate stats |

### Upgrade Features (build after core)
1. Email verification before sending (MX + pattern confidence → avoid bounces)
2. Human-like rate limiting (default 20 emails/day, random delays)
3. Skill-gap analysis ("most missing skills across saved jobs")
4. A/B testing of email templates (track reply rate per template)
5. Job match score shown before applying
6. Interview prep generator (when recruiter replies: likely questions from JD + resume)
7. Resume version history per application
8. Notifications (Telegram/email: new high-match job, reply received)
9. v2: Chrome extension, salary insights, referral finder, multi-resume profiles, weekly report email

---

## 3. Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER (Browser)                            │
└───────────────┬─────────────────────────────────────────────────┘
                │
┌───────────────▼─────────────────────────────────────────────────┐
│   NEXT.JS APP  (Frontend + API Routes)                           │
│   - Auth (NextAuth + Google, incl. Gmail scopes)                 │
│   - Resume upload UI, Dashboard, Tracker, Settings               │
│   - API routes: /api/resume, /api/jobs, /api/applications ...    │
└───────┬───────────────────────────────┬─────────────────────────┘
        │                               │ webhooks (both directions)
┌───────▼────────┐              ┌───────▼──────────────────────────┐
│  POSTGRESQL    │◄────────────►│   n8n  (Automation Engine)       │
│  (Prisma 7)    │              │  WF1: Job Scanner (cron 2h)      │
│                │              │  WF2: Resume Tailor (webhook)    │
│                │              │  WF3: Email Finder (webhook)     │
│                │              │  WF4: Cold Email Sender          │
│                │              │  WF5: Follow-up (cron daily)     │
│                │              │  WF6: Reply Detector (cron 15m)  │
└────────────────┘              └───────┬──────────────────────────┘
                                        │
     ┌──────────────────┬───────────────┼──────────────────────┐
┌────▼─────────┐ ┌──────▼──────┐ ┌──────▼───────────┐ ┌────────▼───────┐
│ FREE Job APIs│ │ Gemini API  │ │ FREE Email Finder│ │ Gmail API      │
│ RemoteOK     │ │ parse/tailor│ │ patterns + MX +  │ │ send + reply   │
│ Remotive     │ │ draft/msgs  │ │ site scraping    │ │ detection      │
│ Arbeitnow    │ └─────────────┘ └──────────────────┘ └────────────────┘
│ Adzuna/Lever │      ┌─────────────────┐
│ Greenhouse   │      │ LaTeX (Tectonic │
└──────────────┘      │ in Docker)      │
                      └─────────────────┘
```

**Key design point:** Next.js and n8n communicate via webhooks in both directions; the DB is the single source of truth. Heavy/slow work (scraping, LLM, PDF compile, schedules) never blocks a web request.

---

## 4. Free API Strategy (zero-cost replacements for paid services)

### Job sources (adapter pattern — one file per source, common interface)

| Source | Cost | Notes |
|---|---|---|
| RemoteOK `remoteok.com/api` | Free public JSON | Remote jobs, tags = skills |
| Remotive `remotive.com/api/remote-jobs` | Free public JSON | Search + category filters |
| Arbeitnow `arbeitnow.com/api/job-board-api` | Free public JSON | Global incl. visa-sponsored |
| Adzuna `developer.adzuna.com` | Free key (~250/day) | India + global, salary data |
| Jooble `jooble.org/api/about` | Free key on request | Big aggregator, India coverage |
| Greenhouse `boards-api.greenhouse.io/v1/boards/{co}/jobs` | Free public | Direct company ATS |
| Lever `api.lever.co/v0/postings/{co}` | Free public | Direct company ATS |
| JSearch (RapidAPI) | Free tier ~200/mo | Google-for-Jobs aggregate; use sparingly |
| HN Who's Hiring (Algolia) | Free public | Startup hiring threads |

### Email finding pipeline (replaces Hunter/Apollo)

```
1. PATTERN DISCOVERY  scrape company /contact /about /team /careers pages,
                      regex-extract emails → learn pattern ({first}.{l}@domain)
2. CANDIDATES         recruiter name × patterns: first@, first.last@, firstlast@,
                      f.last@ + role fallbacks: careers@, jobs@, hr@, talent@
3. VERIFICATION       DNS MX lookup (dns.promises.resolveMx) + catch-all detection
                      (SMTP RCPT-TO blocked on port 25 for most hosts — documented limitation)
4. CONFIDENCE 0-100   found on site: 95 | name+discovered pattern: 80 |
                      name+common pattern+MX ok: 60 | role fallback: 40
```

### Other free choices
LaTeX: Tectonic (Docker) · Email: Gmail API · DB: Neon/Supabase free tier · n8n: self-hosted Docker · Hosting: Vercel free tier · LLM: **Google Gemini free tier** (`gemini-2.5-flash`, no card required) — the project has **zero paid dependencies**. Originally built against Claude and swapped to Gemini once `lib/ai/` proved out as a real provider boundary (see §13 build log) — every call site (resume parsing, tailoring, email drafting) uses Zod schemas + structured output regardless of provider, so the swap touched only `lib/ai/client.ts` and three call sites, not the schemas or business logic.

---

## 5. Database Schema (Prisma — see `prisma/schema.prisma`)

```
users          id, email, gmailTokens(enc), sendMode(APPROVAL|AUTO), dailyEmailCap
profiles       userId, parsedResume(json), targetRoles[], locations[], remoteOnly,
               portfolioUrl, githubUrl, linkedinUrl, originalResumeKey
jobs           title, company, companyDomain, location, remote, description,
               salaryMin/Max, source(enum), sourceUrl, externalId, postedAt
               → @@unique([source, externalId])  = DB-level dedupe
applications   userId, jobId, status(enum), matchScore, atsScore,
               tailoredResumeKey, tailoredResume(json)
               → @@unique([userId, jobId])
recruiters     applicationId, name, role, email, confidence, method, mxVerified
emails         applicationId, type(COLD|FOLLOWUP_1|FOLLOWUP_2), subject, body,
               idempotencyKey @unique  = retries can never double-send,
               sentAt, gmailMessageId, gmailThreadId, repliedAt
linkedin_msgs  applicationId, connectionNote, message, copiedAt
application_events  append-only audit log → tracker timeline
```

Status flow: `FOUND → RESUME_READY → EMAIL_QUEUED → EMAIL_SENT → FOLLOWUP_1 → FOLLOWUP_2 → REPLIED → INTERVIEW → OFFER | REJECTED | NO_RESPONSE`

---

## 6. Rules & Constraints

- **Never fabricate resume content** — tailoring = reorder + rephrase real experience only
- **LinkedIn messages are manual** — no LinkedIn automation (ToS)
- **Email limits**: default 20/day/user, random human-like delays, max 2 follow-ups
- **User's own Gmail** for sending — we assist personal outreach, not bulk mail
- Prefer official APIs; respect robots.txt + rate limits when scraping
- Secrets only in env vars / n8n credentials; approval mode is the default

---

## 7. PHASE PLAN (build order — we work through this top to bottom)

### ✅ Phase 1 — Foundation (DONE)
- [x] Next.js 16 + TS + Tailwind scaffold, repo + GitHub
- [x] Prisma 7 schema (all tables) + pg driver adapter + prisma.config.ts
- [x] Core lib: zod env validation, prisma singleton, pino logger, AppError + apiHandler, safeFetch (timeout/retry/backoff/per-host delay)
- [x] docker-compose: Postgres + n8n

### ✅ Phase 2 — Job Discovery Engine (DONE)
- [x] `JobSourceAdapter` interface + `NormalizedJob` type
- [x] Adapters: RemoteOK, Remotive, Arbeitnow (free, no keys needed)
- [x] Job scan service: parallel fetch (Promise.allSettled — one source failing never kills the scan), normalize, freshness filter, upsert dedupe
- [x] `POST /api/jobs/scan` (secret-protected, n8n will call this) + `GET /api/jobs` (search/filter/paginate)
- [x] Match scoring utility (skill/keyword overlap, 0–100, explainable)

### ✅ Phase 3 — Auth + Profile + Resume Upload (DONE)
- [x] Auth.js v5 with Google provider + Gmail scopes (`gmail.send`, `gmail.readonly`, offline access → refresh token stored on Account); Prisma adapter, database sessions
- [x] Resume upload `POST /api/resume` (PDF via unpdf, DOCX via mammoth; 5MB cap; scanned-image detection)
- [x] Gemini integration `lib/ai/`: `parseResume()` — structured outputs (Zod schema-constrained via `responseJsonSchema`), extraction-only prompt (no fabrication), safety/truncation handling (see §13 for the provider swap from Claude)
- [x] File storage adapter (`lib/storage.ts` — local disk now, S3/Supabase swappable; path-traversal guard)
- [x] Profile service + `GET/PUT /api/profile` (target roles, locations, links, send mode, daily cap)
- [x] UI: landing page with Google sign-in, `/profile` editor (upload → parsed skills preview → preferences form)
- [x] Live database: Neon free-tier Postgres, `20260713193034_init` migration applied — all 12 tables verified, plus an end-to-end job scan confirmed writing real rows (`scripts/smoke-db.ts`)

### ✅ Phase 4 — Resume Tailoring + LaTeX PDF (DONE)
- [x] Single-call JD analysis + tailoring (one LLM round trip = half the cost): structured output with keywords, seniority, tailored resume
- [x] Three-layer no-fabrication defense: prompt rules → schema descriptions → programmatic guard (tailored companies/institutions must exist in master profile, else rejected)
- [x] LaTeX template (`latex-templates/resume.tex`, slot-based — editable without touching code) + single-pass LaTeX escaping (order-safe)
- [x] Compiler adapter: local Tectonic (prod/Docker) with auto-fallback to free remote compile API (dev machines) — verified: real PDF generated
- [x] ATS estimator: 70% JD-keyword coverage + 30% completeness checks; returns covered/missing keywords (explainable)
- [x] `POST /api/applications` (create + match score), `POST /api/applications/:id/tailor`, `GET /api/applications/:id/resume` (PDF download), `GET /api/applications`
- [x] Status transitions + append-only event log (`transitionStatus` / `logEvent`)
- [ ] n8n WF2 wiring lands in Phase 7 with the rest of the automation

### ✅ Phase 5 — Free Email Finder + YC Jobs (DONE)
- [x] **YC jobs source**: `HN_HIRING` adapter — monthly "Ask HN: Who is Hiring" thread via free Algolia API; parses "Company | Role | Location" convention; full-text query filtering (verified live: 85 matching jobs)
- [x] Domain discovery: company name → candidate domains (.com/.io/.co/.ai/.dev/.in) → first with MX records wins; discovered domain cached back onto the job rows
- [x] Site scraper (/, /contact, /about, /team, /careers, /jobs) + email regex + junk filter + pattern learner (first.last / f.last / first_last detection from real emails)
- [x] Candidate generator: recruiter name × 6 patterns + role fallbacks (careers@, jobs@, hr@…)
- [x] MX verification (`dns.promises.resolveMx`); no-MX caps confidence at 15 (bounces poison sender reputation). SMTP RCPT-TO documented as impossible on cloud hosts (port 25 blocked)
- [x] Tiered confidence: careers@ on site 95 · personal on site 90 · name+discovered pattern 80 · name+common pattern 60 · sales@/info@ on site 45 · role fallback 40
- [x] `POST /api/applications/:id/find-recruiter` → stores best on Recruiter row, returns alternates
- [ ] n8n WF3 wiring lands in Phase 7

### ✅ Phase 6 — Cold Email + LinkedIn Messages (DONE — API layer)
- [x] Gmail via raw REST (2 endpoints; skipped the 10MB `googleapis` SDK): token refresh w/ persistence, RFC2822 MIME builder (UTF-8 subjects, PDF attachment, reply threading headers for follow-ups), **retries=0 on send** (an ambiguous-failure retry = double-send)
- [x] One-call outreach drafting: cold email (hook/proof/links/CTA, <150 words, banned-cliché list) + LinkedIn connection note (<280 chars) + LinkedIn DM — single LLM round trip, consistent voice
- [x] Approval flow API: `POST /:id/outreach` (draft, idempotent upsert) → `GET /:id/outreach` (review) → `POST /:id/send` (user edits win over AI draft)
- [x] Daily cap enforced at send time (default 20/day, RATE_LIMITED error) — protects Gmail sender reputation
- [x] Already-sent guard (CONFLICT) + idempotency key `applicationId:COLD`
- [x] `POST /:id/linkedin-copied` — records manual LinkedIn send for the tracker
- [x] Approval screen UI → built in Phase 8; human-like random delays between auto-sends → n8n WF4 (Phase 7, done)

### ✅ Phase 7 — Tracker + Follow-ups + Reply Detection + n8n (DONE)
- [x] Follow-up engine: 7-day ladder EMAIL_SENT→FOLLOWUP_1→FOLLOWUP_2→NO_RESPONSE; **templated, not AI-drafted** (a bump email is formulaic — zero tokens, zero hallucination risk); threaded via `gmailThreadId` + "Re:" subject
- [x] Idempotent by construction: email row created (sentAt=null) BEFORE the Gmail call — a crash mid-send leaves a resumable row, not a duplicate
- [x] Batch-limited (20/run) + random jitter (1-4s) between sends — same anti-burst posture as cold email
- [x] Reply detector: polls Gmail threads for sent-but-unanswered emails every ~15min; any message not from the user = reply; stamps `repliedAt`, **deletes unsent follow-up rows** (ladder cancelled), status → REPLIED
- [x] Grouped per user (one Gmail token fetch per user, not per email) — batch efficiency
- [x] `GET /api/applications/:id` — full detail + append-only event timeline for the tracker drawer
- [x] `POST /api/followups/run`, `POST /api/replies/check` — secret-protected, safe to re-run
- [x] **n8n workflows exported as version-controlled JSON** (`n8n/workflows/`): WF1 job scanner (2h cron), WF2 tailor→find-recruiter chain (webhook), WF4 draft→conditional-send respecting APPROVAL/AUTO mode (webhook), WF5 follow-up cron (daily), WF6 reply-check cron (15min). WF3 folded into WF2.

### ✅ Phase 8 — Dashboard UI (DONE)
- [x] Shared server-rendered nav (reads session directly, no client fetch) + StatusBadge/StatCard primitives
- [x] Dashboard home: 8 stat cards (jobs today/week, active applications, resumes, emails sent, replies, response rate, LinkedIn sent) + pipeline breakdown by status
- [x] `listJobs`/`listApplications`/`getApplicationDetail` extracted into services — pages call them directly server-side (no internal HTTP round-trip); API routes reuse the same services for client-side fetches (DRY, single source of truth)
- [x] Job feed: server-rendered filters (search/source/remote) via plain GET form (works without JS), Apply button (client) → creates application → redirects to detail
- [x] Applications table: status badges, match/ATS scores, links to detail
- [x] Application detail = the full approval screen: Tailor Resume (shows ATS score + missing keywords) → Find Recruiter (confidence + alternates) → Draft Outreach with AI → **editable** subject/body → Send (respects daily cap, shows sent/replied state) → LinkedIn copy buttons (records `copiedAt`) → event timeline, all in one page with optimistic refetch after each action
- [x] Settings already covered by the `/profile` page from Phase 3 (send mode, daily cap, links)

### ✅ Phase 9 — Production Polish (DONE)
- [x] **Gmail tokens encrypted at rest**: AES-256-GCM (key derived from `AUTH_SECRET` via SHA-256), tamper-evident (auth tag). Encryption hooked at the exact two boundaries that touch tokens — an `withEncryptedTokens()` wrapper around the Auth.js Prisma adapter's `linkAccount` (write), and `getGmailAccessToken` in `lib/gmail.ts` (read/refresh-write). `isEncrypted()` guard makes the rollout backwards-compatible with any pre-existing plaintext row. Verified: 7/7 checks in `scripts/smoke-crypto.ts` (round trip, tamper detection, IV uniqueness)
- [x] **Runaway-AI-cost guard**: `assertAiCallBudget()` caps tailoring + drafting calls at 30/user/day using the existing event log — no new table, reuses Phase 4/7 infrastructure
- [x] **Skill-gap analysis**: aggregates `jdAnalysis.requiredSkills`/`niceToHaveSkills` across every tailored application vs. the master profile — zero additional AI calls, pure read of already-stored data; surfaced on the dashboard
- [x] **A/B email templates**: deterministic tone bucket (`concise`/`warm`) hashed from the application id — stable across redrafts, no experiments table; reply-rate-by-variant widget on the dashboard, winner highlighted
- [x] **Notifications**: Telegram Bot API (free, raw REST — same posture as the Gmail client), wired to reply detection; silently no-ops when unconfigured so it never blocks a core flow; per-user opt-in chat ID in `/profile`
- [x] **Security headers**: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` on every response via `next.config.ts`
- [x] **Deployment**: multi-stage `Dockerfile` (Next.js `output: "standalone"` — minimal image, no full `node_modules`) for a VM alongside n8n; deliberately ships **without** a LaTeX binary — `compile.ts`'s local/remote auto-detection (Phase 4) means the exact same code path already handles both Vercel serverless (no Tectonic → remote fallback) and a VM with Tectonic installed, zero config branching needed
- [x] n8n workflow JSONs already exported in Phase 7 (`n8n/workflows/`)

**Deploy checklist:**
1. **Database** — Neon/Supabase free-tier Postgres → `DATABASE_URL`; run `npx prisma migrate deploy`
2. **App (Vercel)** — import the repo, set env vars (`AUTH_SECRET` via `npx auth secret`, `GOOGLE_CLIENT_ID`/`SECRET` with the prod redirect URI added in Google Cloud Console, `GEMINI_API_KEY`, `N8N_CALLBACK_SECRET`, `TELEGRAM_BOT_TOKEN` optional)
3. **n8n** — Railway/Fly/small VM via `docker-compose.yml`, or the provided `Dockerfile` alongside it on one VM; set `APP_BASE_URL` + `N8N_CALLBACK_SECRET` (same value as the app) per `n8n/README.md`; import the 5 workflow JSONs and activate them
4. **Google OAuth** — add the production redirect URI (`https://<domain>/api/auth/callback/google`) in the Cloud Console OAuth client before going live
