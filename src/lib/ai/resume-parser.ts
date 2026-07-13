import { generateStructured } from "@/lib/ai/client";
import { parsedResumeSchema, type ParsedResume } from "@/types/resume";

/**
 * Resume text → structured master profile.
 *
 * EXTRACTION ONLY: the prompt forbids inventing/normalizing content — the
 * same no-fabrication rule that governs tailoring (FEATURES.md §6). Output
 * is schema-constrained (Gemini responseJsonSchema) and re-validated by
 * Zod, so downstream code never sees malformed data.
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
  return generateStructured({
    system: SYSTEM_PROMPT,
    prompt: `Extract the structured profile from this resume:\n\n${resumeText}`,
    schema: parsedResumeSchema,
    maxOutputTokens: 8192,
  });
}
