import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";

/**
 * LLM access lives ONLY behind this module (FEATURES.md §4: the one paid
 * dependency, isolated so the provider is swappable without touching
 * business logic). Originally Claude; swapped to Gemini's free tier so the
 * project has zero paid dependencies end-to-end — the callers in
 * resume-parser.ts / resume-tailor.ts / email-drafter.ts never changed.
 */
export const AI_MODEL = env.GEMINI_MODEL;

let client: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI {
  if (!env.GEMINI_API_KEY) {
    throw new AppError(
      "UPSTREAM_ERROR",
      "AI is not configured — set GEMINI_API_KEY in .env (free key: aistudio.google.com/apikey)",
    );
  }
  client ??= new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  return client;
}

/**
 * Structured-output helper: Zod schema -> Gemini's `responseJsonSchema`
 * (real JSON Schema support, not the older restricted `responseSchema`
 * OpenAPI subset) -> parsed + Zod-validated result.
 *
 * Validating the parsed JSON against the SAME schema again after Gemini
 * returns it is deliberate defense-in-depth: `responseJsonSchema` makes
 * malformed output unlikely, not impossible, and every other AI call site
 * in this codebase trusts the schema, not the model (see AGENTS.md).
 */
export async function generateStructured<T>(options: {
  system: string;
  prompt: string;
  schema: z.ZodType<T>;
  maxOutputTokens?: number;
}): Promise<T> {
  const ai = getAiClient();

  const response = await ai.models.generateContent({
    model: AI_MODEL,
    contents: options.prompt,
    config: {
      systemInstruction: options.system,
      responseMimeType: "application/json",
      responseJsonSchema: z.toJSONSchema(options.schema),
      maxOutputTokens: options.maxOutputTokens ?? 8192,
    },
  });

  const finishReason = response.candidates?.[0]?.finishReason;
  if (finishReason && finishReason !== "STOP") {
    logger.error({ finishReason }, "gemini generation did not complete normally");
    throw new AppError(
      "UPSTREAM_ERROR",
      finishReason === "SAFETY" || finishReason === "RECITATION"
        ? "The AI declined this request — please try again or adjust the input"
        : "The AI response was cut off — please try again",
    );
  }

  const text = response.text;
  if (!text) {
    throw new AppError("UPSTREAM_ERROR", "The AI returned an empty response, please try again");
  }

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    logger.error({ text: text.slice(0, 500) }, "gemini returned non-JSON despite responseJsonSchema");
    throw new AppError("UPSTREAM_ERROR", "The AI response could not be parsed, please try again");
  }

  const parsed = options.schema.safeParse(json);
  if (!parsed.success) {
    logger.error({ issues: parsed.error.issues }, "gemini output failed schema validation");
    throw new AppError("UPSTREAM_ERROR", "The AI response didn't match the expected format, please try again");
  }

  return parsed.data;
}
