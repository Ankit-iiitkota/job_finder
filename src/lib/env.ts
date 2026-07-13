import { setDefaultResultOrder } from "node:dns";
import { z } from "zod";

/**
 * Prefer IPv4 for outbound DNS lookups, process-wide. Several free APIs
 * this app calls (Neon, Adzuna, ...) publish both A and AAAA records; on
 * networks with a broken/slow IPv6 path, Node can pick the AAAA record and
 * hang until a connection-level timeout, which surfaces as an intermittent
 * "fetch failed" / ETIMEDOUT that looks like flaky infrastructure but is
 * actually a routing issue. Lives here (not e.g. db.ts) because env.ts is
 * the one module every server code path imports first — a fix that only
 * ran when the Prisma client happened to load previously left plain
 * `fetch()` calls (job adapters, email finder, etc.) unprotected. Safe:
 * nothing in this app depends on IPv6.
 */
setDefaultResultOrder("ipv4first");

/**
 * Validated environment — the app fails fast at boot with a readable error
 * instead of crashing mysteriously at runtime. (AGENTS.md 4.6 rule 1)
 *
 * Only import this from server code. Never expose values to the client.
 */
const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  // Auth (Auth.js v5)
  AUTH_SECRET: z.string().min(1).optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  // LLM — Groq free tier (see AGENTS.md 4.5: Claude -> Gemini -> Groq, all
  // behind the same lib/ai/ boundary; free key: console.groq.com/keys)
  GROQ_API_KEY: z.string().optional(),
  // Only the gpt-oss family supports response_format:"json_schema" on Groq
  // (confirmed against their docs — most models, including llama-3.3-70b,
  // reject it outright with a 400). gpt-oss-20b and -120b share the same
  // 8000 TPM free-tier ceiling, so the smaller/faster model is the better
  // default with no rate-limit tradeoff. Groq's TPM budget charges
  // prompt_tokens + max_completion_tokens together (not just what's
  // actually generated) — keep maxOutputTokens per call site realistic,
  // not maxed out, or a single request can exceed the cap on its own.
  GROQ_MODEL: z.string().default("openai/gpt-oss-20b"),

  // Free-tier job sources (all optional; adapters skip sources without keys)
  ADZUNA_APP_ID: z.string().optional(),
  ADZUNA_APP_KEY: z.string().optional(),
  ADZUNA_COUNTRY: z.string().length(2).default("in"), // ISO country code Adzuna's API expects in the URL path
  JOOBLE_API_KEY: z.string().optional(),

  // LaTeX compilation
  LATEX_COMPILER: z.enum(["local", "remote"]).optional(),
  LATEX_REMOTE_URL: z.url().default("https://latex.ytotech.com/builds/sync"),

  // Notifications (optional — features degrade gracefully without it)
  TELEGRAM_BOT_TOKEN: z.string().optional(),

  // n8n integration
  N8N_WEBHOOK_BASE_URL: z.string().url().optional(),
  // shared secret: n8n must send this in `x-webhook-secret` when calling us back
  N8N_CALLBACK_SECRET: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  // Treat empty-string env vars as "unset". `.env.example`'s convention for
  // "no value yet" is `KEY=""`, which Zod's `.optional()` only recognizes
  // as absent for plain strings — an empty string still fails `.enum()` and
  // `.url()` validation. Normalizing here fixes the whole schema at once
  // instead of special-casing every non-string optional field.
  const withEmptyAsUnset = Object.fromEntries(
    Object.entries(process.env).map(([key, value]) => [key, value === "" ? undefined : value]),
  );

  const parsed = envSchema.safeParse(withEmptyAsUnset);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`❌ Invalid environment variables:\n${issues}`);
  }
  return parsed.data;
}

export const env = loadEnv();
