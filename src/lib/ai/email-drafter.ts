import { z } from "zod";
import { generateStructured } from "@/lib/ai/client";
import type { ParsedResume } from "@/types/resume";
import type { TailoredResume } from "@/types/tailored-resume";

/**
 * Drafts the ENTIRE outreach kit in one call (cold email + LinkedIn
 * connection note + LinkedIn DM) — one round trip, one consistent voice.
 * The user reviews everything before anything is sent (approval mode).
 */
export const outreachDraftSchema = z.object({
  email: z.object({
    subject: z.string().describe("under 60 chars, specific, no clickbait"),
    body: z
      .string()
      .describe("plain text, under 150 words, ends with the candidate's name"),
  }),
  linkedin: z.object({
    connectionNote: z
      .string()
      .describe("sent WITH the connection request; must be under 280 characters"),
    message: z.string().describe("DM after connecting; under 90 words"),
  }),
});

export type OutreachDraft = z.infer<typeof outreachDraftSchema>;

const SYSTEM_PROMPT = `You write cold outreach for job applications: a short email to the hiring contact plus LinkedIn messages. You write as the CANDIDATE, first person.

Rules for the email:
- Subject: specific and under 60 characters (mention the role; never "Opportunity" or "Job Application").
- Structure: (1) one-line hook showing genuine knowledge of the company/role,
  (2) 2-3 lines of proof — the candidate's REAL experience mapped to the JD's
  top requirements, with concrete results where available,
  (3) one line noting the tailored resume is attached + portfolio/GitHub links,
  (4) a low-friction call to action (e.g. "open to a quick chat this week?").
- Under 150 words. Plain text. No bullet points in the email.
- BANNED: "I hope this email finds you well", "I am writing to express",
  "esteemed organization", "passionate", any flattery, any exaggeration.
- Never claim skills or experience not in the candidate profile.
- Address the contact by first name if known, otherwise "Hi <Company> team".

Rules for LinkedIn:
- connectionNote: under 280 characters, mentions the specific role, friendly not desperate.
- message: under 90 words, assumes they accepted, complements (not repeats) the email.`;

const VARIANT_STYLE: Record<"concise" | "warm", string> = {
  concise:
    "Tone for this draft: CONCISE. Short sentences, get to the point fast, minimal adjectives — the version someone reads in 10 seconds.",
  warm:
    "Tone for this draft: WARM. A touch more personality and specific enthusiasm about the company/role, while staying professional and still under the word limits.",
};

export interface DraftContext {
  candidate: ParsedResume;
  tailored: TailoredResume;
  job: { title: string; company: string };
  recruiterName: string | null;
  links: { portfolio: string | null; github: string | null };
  /** A/B test bucket (server/ab-testing.ts) — same application always gets the same variant. */
  variant?: "concise" | "warm";
}

export async function draftOutreach(context: DraftContext): Promise<OutreachDraft> {
  const variant = context.variant ?? "concise";

  const prompt = [
    `# Target job\n${context.job.title} at ${context.job.company}`,
    `# Hiring contact\n${context.recruiterName ?? "unknown"}`,
    `# What this role needs (from JD analysis)\n${JSON.stringify(context.tailored.jdAnalysis)}`,
    `# Candidate (source of truth — do not go beyond this)\nName: ${context.candidate.name}\nHeadline: ${context.tailored.resume.headline}\nSummary: ${context.tailored.resume.summary}\nTop experience: ${JSON.stringify(context.tailored.resume.experience.slice(0, 2))}\nTop projects: ${JSON.stringify(context.tailored.resume.projects.slice(0, 2))}`,
    `# Links to include\nPortfolio: ${context.links.portfolio ?? "none"}\nGitHub: ${context.links.github ?? "none"}`,
  ].join("\n\n");

  return generateStructured({
    system: `${SYSTEM_PROMPT}\n\n${VARIANT_STYLE[variant]}`,
    prompt,
    schema: outreachDraftSchema,
    maxOutputTokens: 2048,
  });
}
