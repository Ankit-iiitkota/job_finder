import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { AI_MODEL, getAiClient } from "@/lib/ai/client";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { parsedResumeSchema, type ParsedResume } from "@/types/resume";

/**
 * Resume text → structured master profile.
 *
 * EXTRACTION ONLY: the prompt forbids inventing/normalizing content — the
 * same no-fabrication rule that governs tailoring (FEATURES.md §6). Output
 * is schema-constrained (structured outputs) and validated by Zod, so
 * downstream code never sees malformed data.
 */
const SYSTEM_PROMPT = `You extract structured data from resumes.

Rules:
- Extract ONLY what is literally present in the resume text. Never invent,
  infer, or embellish anything.
- Keep bullet points verbatim (fix only obvious OCR artifacts like broken words).
- Use null for anything not present.
- skills: include every technical skill, tool, framework and language mentioned
  anywhere in the resume (including inside experience/project bullets).`;

export async function parseResume(resumeText: string): Promise<ParsedResume> {
  const client = getAiClient();

  const response = await client.messages.parse({
    model: AI_MODEL,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Extract the structured profile from this resume:\n\n${resumeText}`,
      },
    ],
    output_config: { format: zodOutputFormat(parsedResumeSchema) },
  });

  if (response.stop_reason === "refusal" || !response.parsed_output) {
    logger.error({ stop_reason: response.stop_reason }, "resume parsing failed");
    throw new AppError("UPSTREAM_ERROR", "Could not parse the resume, please try again");
  }

  return response.parsed_output;
}
