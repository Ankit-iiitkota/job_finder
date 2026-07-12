import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { findRecruiterEmail, type EmailCandidate } from "@/server/email-finder";
import { logEvent } from "@/server/services/events";

/**
 * Runs the free email pipeline for an application and stores the best
 * candidate on the Recruiter row (n8n WF3 calls this in auto mode).
 */
export interface RecruiterFindResult {
  recruiter: {
    email: string;
    confidence: number;
    method: string;
    mxVerified: boolean;
    name: string | null;
  };
  alternates: EmailCandidate[];
  domain: string | null;
}

export async function findRecruiterForApplication(
  userId: string,
  applicationId: string,
  options?: { recruiterName?: string },
): Promise<RecruiterFindResult> {
  const application = await db.application.findFirst({
    where: { id: applicationId, userId },
    include: { job: { select: { company: true, companyDomain: true } } },
  });
  if (!application) throw new AppError("NOT_FOUND", "Application not found");

  const { domain, candidates } = await findRecruiterEmail({
    companyName: application.job.company,
    companyDomain: application.job.companyDomain,
    recruiterName: options?.recruiterName ?? null,
  });

  const best = candidates[0];
  if (!best) {
    throw new AppError(
      "NOT_FOUND",
      `Could not find any email for ${application.job.company} — no mail domain discoverable`,
    );
  }

  // remember the discovered domain on the job for future applications
  if (domain && !application.job.companyDomain) {
    await db.job.updateMany({
      where: { company: application.job.company, companyDomain: null },
      data: { companyDomain: domain },
    });
  }

  await db.recruiter.upsert({
    where: { applicationId },
    create: {
      applicationId,
      name: options?.recruiterName ?? null,
      email: best.email,
      confidence: best.confidence,
      method: best.method,
      mxVerified: best.mxVerified,
    },
    update: {
      name: options?.recruiterName ?? null,
      email: best.email,
      confidence: best.confidence,
      method: best.method,
      mxVerified: best.mxVerified,
    },
  });

  await logEvent(applicationId, "RECRUITER_FOUND", {
    email: best.email,
    confidence: best.confidence,
    method: best.method,
  });

  return {
    recruiter: {
      email: best.email,
      confidence: best.confidence,
      method: best.method,
      mxVerified: best.mxVerified,
      name: options?.recruiterName ?? null,
    },
    alternates: candidates.slice(1, 6),
    domain,
  };
}
