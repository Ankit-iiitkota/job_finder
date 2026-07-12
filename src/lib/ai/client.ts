import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";

/**
 * LLM access lives ONLY behind this module (FEATURES.md §4: the one paid
 * dependency, isolated so the provider is swappable without touching
 * business logic).
 */
export const AI_MODEL = "claude-opus-4-8";

let client: Anthropic | null = null;

export function getAiClient(): Anthropic {
  if (!env.ANTHROPIC_API_KEY) {
    throw new AppError(
      "UPSTREAM_ERROR",
      "AI is not configured — set ANTHROPIC_API_KEY in .env",
    );
  }
  client ??= new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  return client;
}
