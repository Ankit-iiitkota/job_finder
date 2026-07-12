import { z } from "zod";

/**
 * Output of the tailoring step (FEATURES.md F3): JD analysis + the resume
 * content reshaped for THIS job. This JSON fills the LaTeX template slots.
 *
 * Nullable-not-optional: structured outputs require every property present.
 */
export const jdAnalysisSchema = z.object({
  requiredSkills: z.array(z.string()).describe("hard requirements from the JD"),
  niceToHaveSkills: z.array(z.string()),
  keywords: z
    .array(z.string())
    .describe("ATS keywords an automated screen would look for (tools, methods, domain terms)"),
  seniority: z.enum(["intern", "junior", "mid", "senior", "lead", "unknown"]),
  roleFocus: z.string().describe("one line: what this role is really about"),
});

export const tailoredResumeSchema = z.object({
  jdAnalysis: jdAnalysisSchema,
  resume: z.object({
    name: z.string(),
    headline: z.string().describe("title line aligned to the target role, truthful"),
    email: z.string().nullable(),
    phone: z.string().nullable(),
    location: z.string().nullable(),
    links: z.object({
      github: z.string().nullable(),
      linkedin: z.string().nullable(),
      portfolio: z.string().nullable(),
    }),
    summary: z.string().describe("2-3 lines targeting this JD, built from real experience"),
    skillGroups: z
      .array(z.object({ label: z.string(), skills: z.array(z.string()) }))
      .describe("JD-relevant skills first; only skills the candidate actually has"),
    experience: z.array(
      z.object({
        company: z.string(),
        role: z.string(),
        dates: z.string().describe("e.g. 'Jun 2023 – Present'"),
        bullets: z
          .array(z.string())
          .describe("rephrased with JD keywords where truthful; max 4 per entry"),
      }),
    ),
    projects: z.array(
      z.object({
        name: z.string(),
        tech: z.array(z.string()),
        bullets: z.array(z.string()).describe("max 2 per project"),
        url: z.string().nullable(),
      }),
    ),
    education: z.array(
      z.object({
        institution: z.string(),
        degree: z.string().nullable(),
        years: z.string().nullable(),
        score: z.string().nullable(),
      }),
    ),
    certifications: z.array(z.string()),
  }),
});

export type JdAnalysis = z.infer<typeof jdAnalysisSchema>;
export type TailoredResume = z.infer<typeof tailoredResumeSchema>;
