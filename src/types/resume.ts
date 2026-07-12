import { z } from "zod";

/**
 * The "master profile" — everything we extract from the user's resume.
 * All downstream features (matching, tailoring, emails) read this shape.
 *
 * Structured-outputs note: fields are `.nullable()` rather than `.optional()`
 * because the LLM structured-output schema requires every property present;
 * "unknown" is expressed as null.
 */
export const parsedResumeSchema = z.object({
  name: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  location: z.string().nullable(),
  headline: z.string().nullable().describe("professional title, e.g. 'Full-Stack Developer'"),
  summary: z.string().nullable(),
  skills: z.array(z.string()).describe("technical + soft skills, exactly as written"),
  experience: z.array(
    z.object({
      company: z.string(),
      role: z.string(),
      startDate: z.string().nullable().describe("e.g. 'Jun 2023'"),
      endDate: z.string().nullable().describe("null if current"),
      bullets: z.array(z.string()).describe("achievement bullets, verbatim"),
    }),
  ),
  education: z.array(
    z.object({
      institution: z.string(),
      degree: z.string().nullable(),
      field: z.string().nullable(),
      startYear: z.string().nullable(),
      endYear: z.string().nullable(),
      score: z.string().nullable().describe("CGPA / percentage if mentioned"),
    }),
  ),
  projects: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      tech: z.array(z.string()),
      url: z.string().nullable(),
    }),
  ),
  links: z.object({
    github: z.string().nullable(),
    linkedin: z.string().nullable(),
    portfolio: z.string().nullable(),
  }),
  certifications: z.array(z.string()),
});

export type ParsedResume = z.infer<typeof parsedResumeSchema>;
