import Groq, { APIError } from "groq-sdk";
import { z } from "zod";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";

/**
 * LLM access lives ONLY behind this module (FEATURES.md §4: the one paid
 * dependency, isolated so the provider is swappable without touching
 * business logic). History: Claude -> Gemini free tier -> Groq free tier.
 * This is the SECOND real provider swap and `generateStructured()`'s
 * signature hasn't changed since the first — resume-parser.ts /
 * resume-tailor.ts / email-drafter.ts are untouched again.
 */
export const AI_MODEL = env.GROQ_MODEL;

let client: Groq | null = null;

function getAiClient(): Groq {
  if (!env.GROQ_API_KEY) {
    throw new AppError(
      "UPSTREAM_ERROR",
      "AI is not configured — set GROQ_API_KEY in .env (free key: console.groq.com/keys)",
    );
  }
  client ??= new Groq({ apiKey: env.GROQ_API_KEY });
  return client;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Map a Groq SDK error into our standard AppError envelope (AGENTS.md rule 5: no raw exceptions leak to API responses). */
function toAppError(error: unknown): AppError {
  if (!(error instanceof APIError)) {
    logger.error({ err: error }, "groq call failed before receiving an API response");
    return new AppError("UPSTREAM_ERROR", "The AI request failed, please try again");
  }
  logger.error({ status: error.status, message: error.message }, "groq API returned an error");
  switch (error.status) {
    case 429:
      return new AppError(
        "RATE_LIMITED",
        "The AI is at its free-tier rate limit right now — please wait a moment and try again",
      );
    case 500:
    case 502:
    case 503:
      return new AppError(
        "UPSTREAM_ERROR",
        "The AI service is temporarily overloaded — please try again shortly",
      );
    case 401:
    case 403:
      return new AppError("INTERNAL", "AI authentication failed — check GROQ_API_KEY");
    default:
      return new AppError("UPSTREAM_ERROR", "The AI request failed, please try again");
  }
}

const MAX_GENERATION_RETRIES = 2;
const RETRYABLE_STATUSES = new Set([500, 502, 503]);
// Observed empirically: an occasional one-off model hiccup on the smaller
// gpt-oss-20b produces output that fails Groq's strict-mode JSON validation
// (400 json_validate_failed, empty failed_generation — no useful detail to
// act on). A retry with the identical request succeeded immediately in
// testing, so it's worth one more attempt rather than failing the user's
// request outright.
const RETRYABLE_ERROR_CODES = new Set(["json_validate_failed"]);

function isRetryableGroqError(error: unknown): boolean {
  if (!(error instanceof APIError)) return false;
  if (RETRYABLE_STATUSES.has(error.status ?? 0)) return true;
  const code = (error.error as { code?: string } | undefined)?.code;
  return !!code && RETRYABLE_ERROR_CODES.has(code);
}

interface CreateArgs {
  model: string;
  system: string;
  prompt: string;
  jsonSchema: Record<string, unknown>;
  maxOutputTokens: number;
}

/**
 * Server-side overload (5xx) is worth a couple of quick retries; other
 * errors fail immediately. The `.create({...})` call takes an inline object
 * literal (no `stream` field) so TypeScript resolves the non-streaming
 * overload on its own — extracting the params type via `Parameters<>`
 * instead collapses to the streaming|non-streaming union and loses that.
 */
async function createWithRetry(ai: Groq, args: CreateArgs) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await ai.chat.completions.create({
        model: args.model,
        messages: [
          { role: "system", content: args.system },
          { role: "user", content: args.prompt },
        ],
        response_format: {
          type: "json_schema",
          // strict:true enables real constrained decoding on gpt-oss models
          // (vs. best-effort prompting) — this is also what stops the model
          // from echoing JSON Schema metadata like "$schema" back as a
          // literal output field, which happened once during testing without it.
          json_schema: { name: "structured_output", schema: args.jsonSchema, strict: true },
        },
        max_completion_tokens: args.maxOutputTokens,
      });
    } catch (error) {
      if (!isRetryableGroqError(error) || attempt >= MAX_GENERATION_RETRIES) throw toAppError(error);
      const backoff = 1_000 * 2 ** attempt;
      logger.warn({ attempt: attempt + 1, backoffMs: backoff }, "groq overloaded, retrying");
      await sleep(backoff);
    }
  }
}

/**
 * Strip JSON Schema metadata keys Groq's models can mistake for actual
 * output fields. Empirically verified: sending `z.toJSONSchema()`'s
 * `$schema` key straight through caused gpt-oss-120b to echo `"$schema":
 * "..."` back as a literal property in its JSON output, even with
 * `additionalProperties: false` set — Groq's `json_schema` response format
 * is prompt-guided, not constrained decoding, so it doesn't reject that the
 * way it would a genuinely invalid completion.
 */
function cleanSchema(schema: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(schema).filter(([key]) => key !== "$schema"));
}

/**
 * Structured-output helper: Zod schema -> Groq's OpenAI-compatible
 * `response_format: {type: "json_schema"}` -> parsed + Zod-validated result.
 *
 * Re-validating the parsed JSON against the SAME schema after the call is
 * NOT optional defense-in-depth here the way it was with Gemini — Groq's
 * schema mode is guidance, not a hard guarantee (see cleanSchema above), so
 * this is the primary correctness backstop, not a backup one. Every AI call
 * site in this codebase trusts the schema, not the model (see AGENTS.md).
 */
export async function generateStructured<T>(options: {
  system: string;
  prompt: string;
  schema: z.ZodType<T>;
  maxOutputTokens?: number;
}): Promise<T> {
  const ai = getAiClient();

  const response = await createWithRetry(ai, {
    model: AI_MODEL,
    system: options.system,
    prompt: options.prompt,
    jsonSchema: cleanSchema(z.toJSONSchema(options.schema)),
    maxOutputTokens: options.maxOutputTokens ?? 8192,
  });

  const choice = response.choices[0];
  const finishReason = choice?.finish_reason;
  if (finishReason && finishReason !== "stop") {
    // Groq's finish_reason set has no "declined"/safety category (unlike
    // Gemini's SAFETY/RECITATION) — anything other than "stop" here means
    // the response was cut off (length) or diverted into a tool call.
    logger.error({ finishReason }, "groq generation did not complete normally");
    throw new AppError("UPSTREAM_ERROR", "The AI response was cut off — please try again");
  }

  const text = choice?.message?.content;
  if (!text) {
    throw new AppError("UPSTREAM_ERROR", "The AI returned an empty response, please try again");
  }

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    logger.error({ text: text.slice(0, 500) }, "groq returned non-JSON despite response_format");
    throw new AppError("UPSTREAM_ERROR", "The AI response could not be parsed, please try again");
  }

  const parsed = options.schema.safeParse(json);
  if (!parsed.success) {
    logger.error({ issues: parsed.error.issues }, "groq output failed schema validation");
    throw new AppError("UPSTREAM_ERROR", "The AI response didn't match the expected format, please try again");
  }

  return parsed.data;
}
