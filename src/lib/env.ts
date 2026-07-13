import { z } from "zod";

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

  // LLM (the single paid dependency — see AGENTS.md 4.5)
  ANTHROPIC_API_KEY: z.string().optional(),

  // Free-tier job sources (all optional; adapters skip sources without keys)
  ADZUNA_APP_ID: z.string().optional(),
  ADZUNA_APP_KEY: z.string().optional(),
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
