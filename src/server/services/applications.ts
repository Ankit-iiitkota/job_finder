import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { newStorageKey, storage } from "@/lib/storage";
import { tailorResume } from "@/lib/ai/resume-tailor";
import { computeMatchScore } from "@/server/jobs/match";
import { compileLatexToPdf } from "@/server/latex/compile";
import { renderResumeTex } from "@/server/latex/render-resume";
import { scoreAts, type AtsReport } from "@/server/services/ats";
import { logEvent, transitionStatus } from "@/server/services/events";
import { parsedResumeSchema, type ParsedResume } from "@/types/resume";
import type { TailoredResume } from "@/types/tailored-resume";

/** Application lifecycle service — create → tailor → (later: outreach). */

async function getMasterProfile(userId: string): Promise<ParsedResume> {
  const profile = await db.profile.findUnique({ where: { userId } });
  const parsed = parsedResumeSchema.safeParse(profile?.parsedResume);
  if (!parsed.success) {
    throw new AppError("BAD_REQUEST", "Upload your resume first — no profile found");
  }
  return parsed.data;
}

export async function createApplication(userId: string, jobId: string) {
  const job = await db.job.findUnique({ where: { id: jobId } });
  if (!job) throw new AppError("NOT_FOUND", "Job not found");

  const master = await getMasterProfile(userId);
  const profile = await db.profile.findUnique({ where: { userId } });
  const keywords = [...master.skills, ...(profile?.targetRoles ?? [])];
  const match = computeMatchScore(keywords, {
    title: job.title,
    description: job.description,
  });

  const application = await db.application.upsert({
    where: { userId_jobId: { userId, jobId } },
    create: { userId, jobId, matchScore: match.score },
    update: {}, // applying twice to the same job is a no-op, not an error
  });

  await logEvent(application.id, "APPLICATION_CREATED", { matchScore: match.score });
  return application;
}

/**
 * Anti-fabrication guard (layer 3 of the no-fabrication rule): the LLM output
 * must not contain employers or institutions absent from the master profile.
 * Prompt + schema are layers 1–2; this is the programmatic backstop.
 */
function assertNoFabrication(master: ParsedResume, tailored: TailoredResume): void {
  const norm = (s: string) => s.trim().toLowerCase();
  const knownCompanies = new Set(master.experience.map((x) => norm(x.company)));
  const knownInstitutions = new Set(master.education.map((x) => norm(x.institution)));

  const inventedCompany = tailored.resume.experience.find(
    (x) => !knownCompanies.has(norm(x.company)),
  );
  const inventedSchool = tailored.resume.education.find(
    (x) => !knownInstitutions.has(norm(x.institution)),
  );

  if (inventedCompany || inventedSchool) {
    logger.error(
      { inventedCompany: inventedCompany?.company, inventedSchool: inventedSchool?.institution },
      "fabrication guard tripped",
    );
    throw new AppError(
      "UPSTREAM_ERROR",
      "Generated resume failed the fabrication check — please retry",
    );
  }
}

export interface TailorResult {
  tailored: TailoredResume;
  ats: AtsReport;
  resumeKey: string;
}

export async function tailorApplication(
  userId: string,
  applicationId: string,
): Promise<TailorResult> {
  const application = await db.application.findFirst({
    where: { id: applicationId, userId },
    include: { job: true },
  });
  if (!application) throw new AppError("NOT_FOUND", "Application not found");

  const master = await getMasterProfile(userId);

  const tailored = await tailorResume(master, {
    title: application.job.title,
    company: application.job.company,
    description: application.job.description,
  });
  assertNoFabrication(master, tailored);

  const ats = scoreAts(tailored);

  const tex = await renderResumeTex(tailored);
  const pdf = await compileLatexToPdf(tex);
  const resumeKey = newStorageKey("tailored", userId, "pdf");
  await storage.save(resumeKey, pdf);

  await db.application.update({
    where: { id: application.id },
    data: {
      tailoredResume: tailored,
      tailoredResumeKey: resumeKey,
      atsScore: ats.score,
    },
  });
  await transitionStatus(application.id, "RESUME_READY", {
    type: "RESUME_TAILORED",
    payload: { atsScore: ats.score, missingKeywords: ats.missingKeywords },
  });

  logger.info(
    { applicationId, atsScore: ats.score, pdfBytes: pdf.length },
    "resume tailored",
  );
  return { tailored, ats, resumeKey };
}

export async function listApplications(userId: string) {
  return db.application.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    include: {
      job: {
        select: {
          title: true,
          company: true,
          location: true,
          remote: true,
          sourceUrl: true,
          postedAt: true,
        },
      },
    },
  });
}

export async function getTailoredPdf(
  userId: string,
  applicationId: string,
): Promise<{ pdf: Buffer; filename: string }> {
  const application = await db.application.findFirst({
    where: { id: applicationId, userId },
    include: { job: { select: { company: true } } },
  });
  if (!application?.tailoredResumeKey) {
    throw new AppError("NOT_FOUND", "No tailored resume yet — run tailoring first");
  }
  const pdf = await storage.read(application.tailoredResumeKey);
  const company = application.job.company.replace(/[^a-z0-9]+/gi, "_");
  return { pdf, filename: `resume_${company}.pdf` };
}
