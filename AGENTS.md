<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->


# AI Job Finder — Project Guide (CLAUDE.md)

> This file is the single source of truth for this project. It explains **what we are building, why, and how** — in simple language. Use it as a reference while coding AND while preparing to explain this project in interviews.

---

## 1. What is this project? (One-line pitch)

**An AI-powered job application autopilot**: the user uploads their resume once, and the platform finds fresh jobs, tailors the resume for each job (high ATS score, LaTeX-generated PDF), finds the recruiter/HR/founder's email, sends a personalized cold email with resume + portfolio + GitHub, gives the user a ready-to-send LinkedIn message, auto-follows-up after 7 days if no reply, and tracks everything on a dashboard.

**Interview one-liner:** *"I built a full-stack platform that automates the entire job application pipeline — from job discovery to personalized outreach to follow-up tracking — using Next.js for the product and n8n for the automation workflows, with an LLM doing resume tailoring and email personalization."*

---

## 2. Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Frontend | **Next.js 15 (App Router) + React + TypeScript** | One framework for UI + API routes, SSR for fast dashboard, type safety |
| Styling | **Tailwind CSS + shadcn/ui** | Fast, consistent UI components |
| Backend API | **Next.js API routes / Route Handlers** | Keeps everything in one codebase |
| Database | **PostgreSQL + Prisma ORM** (hosted on Supabase or Neon) | Relational data fits well: users → jobs → applications → emails |
| Automation engine | **n8n (self-hosted or cloud)** | Visual workflows for scraping, email sending, follow-ups, scheduling |
| AI / LLM | **Claude API (`claude-opus-4-8`)** | Resume tailoring, JD analysis, email drafting, LinkedIn message writing |
| Resume PDF | **LaTeX template + compiler** (Tectonic or latexonline in a Docker container) | Clean, ATS-friendly, professional PDF output |
| Email sending | **Gmail API (user's own inbox)** | Free, better deliverability + authenticity |
| Email finding | **Our own FREE pipeline**: pattern generation + DNS MX check + website scraping (see section 4.5) | Hunter/Apollo are paid — we build it ourselves |
| Job sources | **Free APIs first**: RemoteOK, Remotive, Arbeitnow, Adzuna (free tier), Greenhouse/Lever public boards, JSearch free tier | Zero cost, no scraping fragility for MVP (see section 4.5) |
| Auth | **NextAuth.js (Auth.js)** with Google login | Simple, also gives Gmail API access for sending mail |
| File storage | **Supabase Storage / S3** | Store original resumes + generated tailored PDFs |
| Queue/Jobs | **n8n schedules + webhooks** (upgrade path: BullMQ + Redis) | Cron for job scanning and follow-ups |

---

## 3. Core Features (User's Original List)

### F1. Resume Upload & Parsing
- User uploads resume (PDF/DOCX).
- We parse it → extract **skills, experience, education, projects, links** (LLM does the extraction, output as structured JSON).
- This parsed profile becomes the user's "master profile" — the base for all tailored resumes.

### F2. Job Discovery (Recently Posted First)
- Platform searches jobs across multiple platforms **based on the user's skills**.
- **Freshness filter**: only recently posted jobs (last 24–72 hours) — because early applicants get seen first.
- n8n workflows run on a schedule (e.g. every 2 hours) → scrape/fetch jobs → dedupe → score match % against user profile → save to DB.

### F3. JD Analysis + ATS-Optimized Resume Generation
- For each matched job, read the **Job Description (JD)**.
- LLM rewrites/reorders the user's resume content to match the JD: keywords, skills ordering, bullet phrasing — targeting a **high ATS score**.
- **Rule: never invent fake experience.** Only rephrase/reorder what the user actually has.
- Output goes into our **LaTeX template** → compiled → clean PDF.
- We compute an **ATS score estimate** (keyword overlap + formatting checks) and show it to the user.

### F4. Recruiter / HR / Founder Email Finding (100% FREE pipeline)
- For each job's company: find the hiring person (recruiter, HR, hiring manager, or founder for startups).
- **Our free pipeline** (no Hunter/Apollo — see section 4.5 for full detail):
  1. Scrape the company website (`/careers`, `/about`, `/team`, `/contact`) for any public emails → learn the company's email **pattern** from them.
  2. Generate candidate emails from common patterns (`first@`, `first.last@`, `firstlast@`, `f.last@`).
  3. Verify with **DNS MX lookup** (does the domain even receive mail?) + catch-all detection.
  4. Assign a confidence score; show top candidate + alternates to the user.
- Fallback: careers-page "apply" email, `jobs@`/`careers@`/`hr@company.com`, founder email for small startups.

### F5. Cold Email Sending
- LLM drafts a **personalized cold email** using our fixed template structure:
  - Hook (why this company/role specifically)
  - 2–3 lines of relevant proof (skills/projects matching the JD)
  - Links: **resume (tailored PDF), portfolio, GitHub**
  - Clear, polite call-to-action
- Sent **from the user's own Gmail** (via Gmail API) — better deliverability, feels human.
- User can review/edit before send (approval mode) OR enable full auto mode.

### F6. LinkedIn Message Generator
- Platform generates a short LinkedIn DM (connection note + follow-up message) for the recruiter.
- **User sends it manually** (LinkedIn automation violates their ToS — we stay safe).
- One-click "copy message" + direct link to recruiter's LinkedIn profile.

### F7. Application Tracker + Auto Follow-up
- Every application tracked with status: `Found → Resume Generated → Email Sent → Follow-up Sent → Replied → Interview → Offer / Rejected / No Response`.
- **If no reply in 7 days → n8n automatically sends a polite follow-up email** (max 2 follow-ups, then mark as "No Response").
- Reply detection: watch the user's inbox (Gmail API) for replies from the recruiter's email.

### F8. Dashboard
- All key info in one place:
  - Jobs found today / this week
  - Applications sent + their status (kanban or table view)
  - Resumes generated (view/download each tailored PDF)
  - Emails sent, opened (if tracking), replied
  - Follow-ups scheduled/sent
  - Response rate & other stats

---

## 4. Suggested Upgrade Features (My Additions — makes the project stand out)

### High value, add these:
1. **Email verification before sending** — our free MX + pattern-confidence verification (section 4.5) to avoid bounces. High bounce rate = user's Gmail gets flagged as spam. *This is a real engineering concern interviewers love hearing about.*
2. **Rate limiting / human-like sending** — max 15–25 cold emails/day per user, spread across the day with random gaps. Protects the user's email reputation.
3. **Skill-gap analysis** — "This JD wants Docker and you don't have it. Here are the 3 most common skills you're missing across saved jobs." Turns rejections into a learning roadmap.
4. **A/B testing of email templates** — track which subject lines / templates get more replies, auto-prefer the winner.
5. **Job match score** — show a % match (skills overlap, experience level, location) so the user applies to best-fit jobs first.
6. **Interview prep generator** — once a recruiter replies, auto-generate likely interview questions from the JD + user's resume.
7. **Resume version history** — every tailored resume saved and linked to its application; user can see exactly what was sent where.
8. **Notifications** — Telegram/WhatsApp/email alert when: new high-match job found, recruiter replied, follow-up sent.

### Nice-to-have (v2):
9. **Chrome extension** — user browsing LinkedIn/Indeed sees a job → one click "Apply via JobFinder".
10. **Salary insights** — scrape/estimate salary range per job.
11. **Referral finder** — find user's 2nd-degree connections working at the target company.
12. **Multi-resume profiles** — e.g. one profile for "Frontend Dev", one for "Full-Stack" roles.
13. **Open/click tracking on emails** — tracking pixel + link wrapping (make it optional; some consider it invasive).
14. **Weekly report email** — "This week: 42 jobs found, 12 applied, 3 replies."

---

## 4.5 FREE API Strategy (Zero-cost replacements for paid services)

> **Decision:** Hunter.io / Apollo.io / Snov.io are paid → we build our own free alternatives. This is actually a **plus point in interviews**: "I engineered a zero-cost email discovery pipeline instead of paying for an API."

### Free Job Sources (all free, no scraping needed for MVP)

| Source | Type | Cost | Notes |
|---|---|---|---|
| **RemoteOK** (`remoteok.com/api`) | Public JSON API | Free | Remote jobs, tags = skills, easy to match |
| **Remotive** (`remotive.com/api/remote-jobs`) | Public JSON API | Free | Remote jobs, category + search filters |
| **Arbeitnow** (`arbeitnow.com/api/job-board-api`) | Public JSON API | Free | Global jobs incl. visa-sponsored |
| **Adzuna** (`developer.adzuna.com`) | API key (free tier) | Free (~250 calls/day) | India + global jobs, salary data included |
| **Jooble** (`jooble.org/api/about`) | API key (free on request) | Free | Big aggregator, good India coverage |
| **Greenhouse public boards** (`boards-api.greenhouse.io/v1/boards/{company}/jobs`) | Public API | Free | Direct company jobs — many startups use it |
| **Lever public postings** (`api.lever.co/v0/postings/{company}`) | Public API | Free | Same — direct from company ATS |
| **JSearch (RapidAPI)** | API key | Free tier (~200 req/mo) | Aggregates Google-for-Jobs (includes LinkedIn/Indeed listings) — use sparingly for high-value searches |
| **HN Who's Hiring** (Algolia API) | Public API | Free | Monthly startup hiring threads |

**Adapter pattern:** every source implements the same `JobSourceAdapter` interface (`fetchJobs(query) → NormalizedJob[]`). Adding a new source = adding one adapter file. This is the key design pattern to mention in interviews.

### Free Email Finding Pipeline (replaces Hunter/Apollo)

```
Step 1: PATTERN DISCOVERY (free)
  - Fetch company website pages: /contact, /about, /team, /careers, /privacy, /terms
  - Regex-extract any emails found → learn the pattern (e.g. found "rahul.k@acme.com"
    → company uses {first}.{l}@domain)

Step 2: CANDIDATE GENERATION (free)
  - Recruiter name (from job posting / careers page) + discovered or common patterns:
    first@, first.last@, firstlast@, f.last@, first_last@, last.first@
  - Always include role-based fallbacks: careers@, jobs@, hr@, talent@, hello@

Step 3: VERIFICATION (free)
  - DNS MX record lookup (Node `dns.promises.resolveMx`) → domain accepts mail at all?
  - Catch-all detection: probe a random address — if it "exists", domain is catch-all
    (pattern confidence matters more than probe result)
  - (SMTP RCPT-TO handshake is possible but port 25 is blocked on most hosts —
    documented limitation; we rely on MX + pattern confidence instead)

Step 4: CONFIDENCE SCORE (0–100)
  - Email literally found on website: 95
  - Name + discovered company pattern: 80
  - Name + common pattern, MX valid: 60
  - Role-based fallback (careers@): 40
  → We send to the highest-confidence address; user sees the score.
```

### Other free choices
- **LaTeX compiling**: Tectonic (open source, runs in Docker) — free
- **Email sending + reply detection**: Gmail API — free
- **Database**: Neon / Supabase free tier Postgres — free
- **n8n**: self-hosted via Docker — free
- **Hosting**: Vercel free tier (app) + any free-tier VM / local for n8n
- **LLM**: Claude API is the one paid dependency (user's own key). Code isolates all LLM calls behind `lib/ai/` so the provider can be swapped (e.g. Gemini free tier) without touching business logic.

---

## 4.6 Git & Code Conventions

- **Repo**: `https://github.com/Ankit-iiitkota/job_finder`
- **Commits**: conventional commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`). **No co-author lines.**
- **Branch**: work on `main` for now (solo project); feature branches once the core is stable.
- **Push** after every meaningful unit of work.
- **CLAUDE.md is updated with every feature** — it doubles as the interview-prep document.

### Production-grade code rules (senior-dev standard)
1. **Validated environment** — all env vars parsed with Zod at boot (`src/lib/env.ts`); app fails fast with a clear error instead of crashing at runtime.
2. **Typed everything** — no `any`; shared types in `src/types/`; Prisma generates DB types.
3. **Thin routes, fat services** — API route handlers only validate input + call a service function (`src/server/services/`). Business logic never lives in route files (testable, reusable from n8n webhooks too).
4. **Input validation at every boundary** — Zod schemas for every API request body and every n8n callback payload.
5. **Consistent error handling** — a single `AppError` class + central handler → every API returns `{ error: { code, message } }` with proper HTTP status; no leaked stack traces.
6. **Structured logging** — `pino` logger with request IDs, not `console.log`.
7. **Rate limiting & retries** — external calls (job APIs, website scraping) go through a fetch wrapper with timeout, retry + exponential backoff, and per-host rate limiting.
8. **Adapter pattern for integrations** — job sources, email providers, LLM providers are swappable behind interfaces.
9. **Idempotent workflows** — n8n callbacks carry an idempotency key so retries never double-send an email.
10. **Security** — n8n→app webhooks authenticated with a shared secret header; Gmail OAuth tokens encrypted at rest; secrets only in env.

---

## 5. Architecture (How everything connects)

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER (Browser)                            │
└───────────────┬─────────────────────────────────────────────────┘
                │
┌───────────────▼─────────────────────────────────────────────────┐
│   NEXT.JS APP  (Frontend + API Routes)                           │
│   - Auth (NextAuth + Google)                                     │
│   - Resume upload UI, Dashboard, Application tracker, Settings   │
│   - API routes: /api/resume, /api/jobs, /api/applications ...    │
└───────┬───────────────────────────────┬─────────────────────────┘
        │                               │ webhooks (both directions)
┌───────▼────────┐              ┌───────▼──────────────────────────┐
│  POSTGRESQL    │◄────────────►│   n8n  (Automation Engine)       │
│  (Prisma ORM)  │              │                                  │
│  users         │              │  WF1: Job Scanner (cron 2h)      │
│  profiles      │              │  WF2: Resume Tailor (webhook)    │
│  jobs          │              │  WF3: Email Finder (webhook)     │
│  applications  │              │  WF4: Cold Email Sender          │
│  emails        │              │  WF5: Follow-up (cron daily)     │
│  followups     │              │  WF6: Reply Detector (cron 15m)  │
└────────────────┘              └───────┬──────────────────────────┘
                                        │ calls external services
              ┌─────────────────────────┼──────────────────────────┐
              │                         │                          │
     ┌────────▼────────┐   ┌────────────▼───────┐   ┌──────────────▼─────┐
     │ Job Platforms   │   │  Claude API (LLM)  │   │ FREE Email Finder  │
     │ (FREE APIs)     │   │  - parse resume    │   │ (our own: patterns │
     │ RemoteOK/Remotive│  │  - analyze JD      │   │  + MX check +      │
     │ Adzuna/Greenhouse│  │  - tailor resume   │   │  site scraping)    │
     │ Lever/Arbeitnow │   │                    │   └────────────────────┘
     └─────────────────┘   │  - draft emails    │   ┌────────────────────┐
                           │  - LinkedIn msgs   │   │ Gmail API (send    │
     ┌─────────────────┐   └────────────────────┘   │ from user's inbox, │
     │ LaTeX Compiler  │                            │ detect replies)    │
     │ (Docker service)│                            └────────────────────┘
     └─────────────────┘
```

### The n8n Workflows (heart of the automation)

| # | Workflow | Trigger | What it does |
|---|---|---|---|
| WF1 | **Job Scanner** | Cron (every 2 hrs) | For each active user: fetch new jobs from all sources → dedupe (same job on 2 platforms = 1 entry) → filter by freshness (<72h) → compute match score vs user skills → insert into DB → notify user of high matches |
| WF2 | **Resume Tailor** | Webhook (user clicks "Apply" or auto mode) | Fetch JD + master profile → Claude rewrites resume content for this JD → inject into LaTeX template → compile PDF → store → compute ATS score → update application status |
| WF3 | **Email Finder** | Webhook (after WF2) | Company domain lookup → our FREE pipeline (site scrape → pattern discovery → candidate generation → MX verification) → save recruiter contact with confidence score |
| WF4 | **Cold Email Sender** | Webhook (after user approval, or auto) | Claude drafts personalized email from template → attach/link tailored resume + portfolio + GitHub → send via user's Gmail → log message-id → status = "Email Sent" → generate LinkedIn message for manual sending |
| WF5 | **Follow-up Engine** | Cron (daily) | Find applications where `status = Email Sent` AND `sent_date <= now - 7 days` AND `no reply` → send polite follow-up → max 2 follow-ups → then status = "No Response" |
| WF6 | **Reply Detector** | Cron (every 15 min) | Check user's Gmail inbox for replies from tracked recruiter emails → if reply found: status = "Replied" → cancel pending follow-ups → notify user |

**Key design point (say this in interviews):** Next.js and n8n talk to each other via **webhooks in both directions**. The app triggers workflows (e.g. "tailor resume for job X") by calling an n8n webhook URL; n8n reports results back by calling a Next.js API route (or writing to the shared DB). This keeps heavy/slow work (scraping, LLM calls, PDF compile, email schedules) **out of the web request cycle** — the UI never blocks.

---

## 6. Database Schema (main tables)

```
users          → id, email, name, gmail_tokens, settings (daily email limit, auto/approval mode)
profiles       → id, user_id, parsed_resume_json (skills, experience, education, projects),
                 portfolio_url, github_url, linkedin_url, original_resume_file
jobs           → id, title, company, company_domain, location, jd_text, source_platform,
                 source_url, posted_at, scraped_at, salary_range?
applications   → id, user_id, job_id, status, match_score, ats_score,
                 tailored_resume_file, created_at, updated_at
recruiters     → id, job_id, name, role, email, email_confidence, linkedin_url, verified
emails         → id, application_id, type (cold|followup1|followup2), subject, body,
                 sent_at, gmail_message_id, opened_at?, replied_at?
linkedin_msgs  → id, application_id, message_text, copied_at?
events         → id, application_id, event_type, payload, created_at   (audit log for tracker timeline)
```

Status enum for `applications`:
`FOUND → RESUME_READY → EMAIL_QUEUED → EMAIL_SENT → FOLLOWUP_1 → FOLLOWUP_2 → REPLIED → INTERVIEW → OFFER | REJECTED | NO_RESPONSE`

---

## 7. Key Flows (step by step — memorize for interviews)

### Flow A: Onboarding
1. User signs up with Google (we also request Gmail send/read scope).
2. Uploads resume → we extract text → Claude parses into structured JSON → user reviews/edits parsed profile → adds portfolio/GitHub/LinkedIn links → sets preferences (roles, locations, remote, daily email limit, auto vs approval mode).

### Flow B: Job → Application (the main pipeline)
1. WF1 finds a fresh job matching user's skills (match score 85%).
2. User sees it on dashboard (or auto mode picks it) → clicks Apply.
3. WF2: Claude reads JD → tailors resume → LaTeX → PDF → ATS score 91%.
4. WF3: finds recruiter "Priya Sharma, Talent Acquisition, priya@company.com (95% confidence, verified)".
5. WF4: Claude drafts cold email → user approves (or auto) → sent from user's Gmail with resume link + portfolio + GitHub.
6. Dashboard shows LinkedIn message ready → user copies → sends manually on LinkedIn.
7. Day 7, no reply → WF5 sends follow-up automatically.
8. Recruiter replies → WF6 detects it → follow-ups cancelled → user notified → status "Replied".

### Flow C: Resume Tailoring detail (the AI core)
1. Input: master profile JSON + JD text.
2. Claude extracts from JD: required skills, keywords, seniority, responsibilities.
3. Claude rewrites resume: reorders skills (JD-relevant first), rephrases bullets with JD keywords, picks the most relevant projects. **Rule: no fabrication — only reorder/rephrase real data.**
4. Output: structured JSON matching our LaTeX template slots.
5. Server fills LaTeX template → compiles (Tectonic in Docker) → PDF stored.
6. ATS estimate = keyword coverage % + format checks (no tables/images, standard headings, parseable fonts).

---

## 8. Important Rules & Constraints

- **Never fabricate resume content.** Tailoring = reordering + rephrasing real experience only.
- **LinkedIn messages are manual** — user sends them. No LinkedIn automation (ToS violation, account ban risk).
- **Respect email limits**: default 20 cold emails/day/user, human-like random delays. Max 2 follow-ups per application.
- **User's own Gmail for sending** — we are a tool assisting the user's own outreach, not a bulk mailer.
- **Scraping**: prefer official APIs/RSS; where scraping, respect robots.txt and rate limits; cache results.
- **Secrets**: all API keys (Claude, Hunter, Gmail OAuth) live in env vars / n8n credentials store — never in code.
- **Approval mode is default** — user reviews emails before sending. Auto mode is opt-in.

---

## 9. Project Structure (planned)

```
ai_job_finder/
├── CLAUDE.md                  ← this file
├── app/                       ← Next.js App Router
│   ├── (auth)/                ← login/signup pages
│   ├── dashboard/             ← main dashboard, tracker, stats
│   ├── jobs/                  ← job feed, job detail
│   ├── profile/               ← resume upload, parsed profile editor, settings
│   └── api/                   ← route handlers (resume, jobs, applications, webhooks from n8n)
├── components/                ← shared React components (shadcn/ui based)
├── lib/
│   ├── db.ts                  ← Prisma client
│   ├── claude.ts              ← Claude API helpers (parse resume, tailor, draft email)
│   ├── latex/                 ← LaTeX template + compile helpers
│   ├── gmail.ts               ← Gmail send/read helpers
│   └── ats.ts                 ← ATS scoring logic
├── prisma/
│   └── schema.prisma
├── n8n/
│   └── workflows/             ← exported n8n workflow JSONs (version-controlled!)
├── latex-templates/
│   └── resume.tex             ← master resume template with placeholders
└── docker-compose.yml         ← postgres + n8n + latex compiler for local dev
```

---

## 10. Build Order (Roadmap)

**Phase 1 — Foundation (MVP core)**
1. Next.js app + auth (Google) + Postgres/Prisma setup
2. Resume upload → Claude parsing → profile editor
3. LaTeX template + PDF compile pipeline
4. Manual flow first: paste a JD → get tailored resume PDF + ATS score

**Phase 2 — Automation**
5. n8n setup (docker-compose) + WF1 Job Scanner (start with 1–2 sources like RemoteOK API — easiest)
6. WF3 Email Finder integration
7. WF4 Cold email drafting + Gmail sending + LinkedIn message generator

**Phase 3 — Tracking**
8. Application tracker + dashboard
9. WF5 Follow-up engine + WF6 Reply detection
10. Notifications

**Phase 4 — Polish/upgrades**
11. Email verification, rate limiting, A/B templates, skill-gap analysis, interview prep generator

---

## 11. Interview Q&A Cheat Sheet

**Q: Why n8n instead of writing cron jobs / queues yourself?**
A: Faster iteration on multi-step integrations (scrape → LLM → email), built-in retries and error handling, visual debugging of workflow runs, and easy credential management. For core product logic I still use TypeScript in Next.js — n8n only handles orchestration of external services. If scale demanded it, I'd migrate hot paths to BullMQ workers.

**Q: How do you get a "high ATS score"?**
A: ATS systems mostly do keyword matching + need parseable structure. So: (1) LLM extracts JD keywords and works them naturally into real experience bullets, (2) LaTeX template uses ATS-safe layout — standard section headings, no tables/columns/images, real text not glyphs, (3) we score keyword coverage ourselves and show it.

**Q: How do you avoid the emails being spam?**
A: Send from the user's own Gmail (real person, real inbox), low daily volume with random delays, verified recipient emails to avoid bounces, personalized content per email (no identical blasts), and max 2 follow-ups.

**Q: Biggest technical challenges?**
A: (1) Job scraping reliability — different sites, layout changes, anti-bot measures → solved with per-source adapters in n8n + official APIs where possible. (2) Email finding accuracy → confidence scores + verification step. (3) Keeping LLM output faithful — resume must not contain invented facts → strict prompt rules + structured JSON output validated against the master profile. (4) Async coordination — webhooks both ways between app and n8n with the DB as the single source of truth.

**Q: How does the LLM part work?**
A: Claude API with structured outputs (JSON schema) so responses are machine-parseable: resume parsing → JSON, JD analysis → JSON, tailored resume → JSON that fills LaTeX slots, email drafting → subject+body. Prompt caching on the fixed system prompts keeps cost down.

**Q: What would you do differently at scale?**
A: Move scraping to dedicated workers with proxies, BullMQ + Redis for queues, separate the LaTeX compile service, add per-user encryption for Gmail tokens, and multi-tenant rate limiting.

---

## 12. Env Variables (planned)

```
DATABASE_URL=
NEXTAUTH_SECRET=
GOOGLE_CLIENT_ID=            # OAuth + Gmail API
GOOGLE_CLIENT_SECRET=
ANTHROPIC_API_KEY=           # Claude API (only paid dependency)
ADZUNA_APP_ID=               # free tier job source
ADZUNA_APP_KEY=
JOOBLE_API_KEY=              # free key (optional)
N8N_WEBHOOK_BASE_URL=        # app → n8n triggers
N8N_CALLBACK_SECRET=         # n8n → app webhook auth
STORAGE_BUCKET_URL=          # resume PDFs
```


---

## 13. Build Progress Log (updated as we code — interview notes per step)

> Note: `CLAUDE.md` is now just a pointer (`@AGENTS.md`) — this file is the real guide. That is the Next.js 16 convention generated by create-next-app.

### Step 1 — Foundation (done)
**What:** Next.js 16 (App Router, TypeScript, Tailwind) + Prisma 7 + core `src/lib` utilities + docker-compose (Postgres + n8n).

**Decisions worth explaining in interviews:**
- **Prisma 7 breaking changes handled**: v7 removed `url` from `schema.prisma` (moved to `prisma.config.ts`), replaced the Rust engine with a TS client + **driver adapters** (`@prisma/adapter-pg`), and generates the client into our source tree (`src/generated/prisma`, gitignored + regenerated on `postinstall`). Good story about reading release notes instead of copy-pasting outdated tutorials.
- **`src/lib/env.ts`** — Zod parses `process.env` at boot; a missing/invalid var crashes immediately with a readable list instead of a mysterious runtime error. "Fail fast" principle.
- **`src/lib/errors.ts`** — one `AppError(code, message)` class + `apiHandler()` wrapper; every API route returns the same `{ error: { code, message } }` envelope, correct HTTP status, no leaked stack traces.
- **`src/lib/http.ts`** — `safeFetch()`: every external call gets a hard timeout (AbortController), retries with exponential backoff + jitter on 429/5xx, and a per-host politeness delay (never hammer one domain). This is where "production grade" lives for scraping/API polling.
- **`src/lib/logger.ts`** — pino structured logging (JSON in prod, pretty in dev), child loggers with request ids for tracing a request across services.
- **Schema design highlights**: `@@unique([source, externalId])` on jobs = dedupe at the DB level (same job fetched twice can never duplicate); `idempotencyKey @unique` on emails = an n8n retry can never double-send; `ApplicationEvent` append-only table powers the tracker timeline (audit-log pattern).

### Next up (Step 2)
Job source adapters (free APIs: RemoteOK, Remotive, Arbeitnow) behind a common `JobSourceAdapter` interface + `/api/jobs/scan` endpoint + matching score.
