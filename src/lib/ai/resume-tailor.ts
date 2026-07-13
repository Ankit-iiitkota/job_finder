import { generateStructured } from "@/lib/ai/client";
import type { ParsedResume } from "@/types/resume";
import { tailoredResumeSchema, type TailoredResume } from "@/types/tailored-resume";

/**
 * The AI core (FEATURES.md F3): master profile + JD → JD analysis + a resume
 * reshaped for this job. ONE call does both (cheaper than two round trips;
 * the analysis grounds the tailoring).
 *
 * The no-fabrication rule lives in three layers:
 *  1. this prompt, 2. the schema descriptions, 3. a programmatic guard in the
 *  application service that cross-checks companies/education against the
 *  master profile after the call.
 */
const SYSTEM_PROMPT = `You tailor resumes to job descriptions for ATS (applicant tracking system) screens.

HARD RULES — violating any of these makes the output unusable:
- NEVER invent experience, skills, projects, employers, dates, titles, or metrics.
  Every fact must come from the candidate profile. You may only REORDER,
  SELECT, and REPHRASE what is there.
- Use the JD's exact terminology when the candidate genuinely has that skill
  (e.g. profile says "React.js", JD says "React" → write "React").
- Order everything by relevance to THIS job: most relevant skills first,
  most relevant bullets first within each role.
- Prefer strong action verbs and keep quantified results exactly as stated.
- Keep it one page: max 4 bullets per experience entry, max 2 per project,
  drop the least relevant projects if there are more than 3.
- If the candidate lacks a required skill, DO NOT add it anywhere.`;

export async function tailorResume(
  profile: ParsedResume,
  job: { title: string; company: string; description: string },
): Promise<TailoredResume> {
  const prompt = [
    `# Job\nTitle: ${job.title}\nCompany: ${job.company}\n\n## Description\n${job.description}`,
    `# Candidate profile (the ONLY source of truth)\n${JSON.stringify(profile, null, 2)}`,
    `Analyze the JD, then produce the tailored resume.`,
  ].join("\n\n---\n\n");

  return generateStructured({
    system: SYSTEM_PROMPT,
    prompt,
    schema: tailoredResumeSchema,
    // Groq's free-tier TPM budget charges prompt + completion together
    // (see lib/ai/client.ts) — this is the largest of the three AI calls
    // (JD analysis + full tailored resume), so it gets the most headroom.
    maxOutputTokens: 3500,
  });
}
