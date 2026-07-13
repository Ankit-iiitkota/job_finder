import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { storage } from "@/lib/storage";
import { sendGmail } from "@/lib/gmail";
import { draftOutreach, type OutreachDraft } from "@/lib/ai/email-drafter";
import { assignEmailVariant } from "@/server/services/ab-testing";
import { assertAiCallBudget } from "@/server/services/ai-usage-guard";
import { logEvent, transitionStatus } from "@/server/services/events";
import { parsedResumeSchema } from "@/types/resume";
import { tailoredResumeSchema } from "@/types/tailored-resume";

/**
 * Outreach lifecycle (FEATURES.md F5/F6):
 *   draft (AI writes email + LinkedIn kit, stored, status EMAIL_QUEUED)
 *   → user reviews/edits (approval mode — the default)
 *   → send (daily cap enforced, PDF attached, sent from user's Gmail)
 */

async function loadApplication(userId: string, applicationId: string) {
  const application = await db.application.findFirst({
    where: { id: applicationId, userId },
    include: {
      job: true,
      recruiter: true,
      user: { include: { profile: true } },
    },
  });
  if (!application) throw new AppError("NOT_FOUND", "Application not found");
  return application;
}

export async function draftApplicationOutreach(userId: string, applicationId: string) {
  const application = await loadApplication(userId, applicationId);

  const tailored = tailoredResumeSchema.safeParse(application.tailoredResume);
  if (!tailored.success) {
    throw new AppError("BAD_REQUEST", "Tailor the resume first — no tailored resume found");
  }
  if (!application.recruiter) {
    throw new AppError("BAD_REQUEST", "Find the recruiter first — no contact on this application");
  }
  const candidate = parsedResumeSchema.safeParse(application.user.profile?.parsedResume);
  if (!candidate.success) {
    throw new AppError("BAD_REQUEST", "No master profile — upload your resume first");
  }

  await assertAiCallBudget(userId);
  const variant = assignEmailVariant(applicationId);

  const draft: OutreachDraft = await draftOutreach({
    candidate: candidate.data,
    tailored: tailored.data,
    job: { title: application.job.title, company: application.job.company },
    recruiterName: application.recruiter.name,
    links: {
      portfolio: application.user.profile?.portfolioUrl ?? null,
      github: application.user.profile?.githubUrl ?? null,
    },
    variant,
  });

  // idempotencyKey makes "draft twice" an update, never a duplicate row
  const [email, linkedin] = await db.$transaction([
    db.email.upsert({
      where: { idempotencyKey: `${applicationId}:COLD` },
      create: {
        applicationId,
        type: "COLD",
        subject: draft.email.subject,
        body: draft.email.body,
        variant,
        idempotencyKey: `${applicationId}:COLD`,
      },
      update: { subject: draft.email.subject, body: draft.email.body, variant },
    }),
    db.linkedInMessage.upsert({
      where: { applicationId },
      create: {
        applicationId,
        connectionNote: draft.linkedin.connectionNote,
        message: draft.linkedin.message,
      },
      update: {
        connectionNote: draft.linkedin.connectionNote,
        message: draft.linkedin.message,
      },
    }),
  ]);

  await transitionStatus(applicationId, "EMAIL_QUEUED", { type: "OUTREACH_DRAFTED" });
  return { email, linkedin, recruiter: application.recruiter };
}

/** How many emails this user has sent since UTC midnight (cap enforcement). */
async function sentTodayCount(userId: string): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  return db.email.count({
    where: { application: { userId }, sentAt: { gte: startOfDay } },
  });
}

export interface SendOverrides {
  subject?: string;
  body?: string;
}

export async function sendColdEmail(
  userId: string,
  applicationId: string,
  overrides: SendOverrides = {},
) {
  const application = await loadApplication(userId, applicationId);
  if (!application.recruiter) {
    throw new AppError("BAD_REQUEST", "No recruiter contact on this application");
  }
  if (!application.tailoredResumeKey) {
    throw new AppError("BAD_REQUEST", "No tailored resume PDF — run tailoring first");
  }

  const email = await db.email.findUnique({
    where: { idempotencyKey: `${applicationId}:COLD` },
  });
  if (!email) throw new AppError("BAD_REQUEST", "Draft the outreach first");
  if (email.sentAt) {
    throw new AppError("CONFLICT", "This cold email was already sent");
  }

  // daily cap — protects the user's Gmail sender reputation (FEATURES.md §6)
  const cap = application.user.dailyEmailCap;
  const sentToday = await sentTodayCount(userId);
  if (sentToday >= cap) {
    throw new AppError(
      "RATE_LIMITED",
      `Daily email cap reached (${sentToday}/${cap}) — resumes tomorrow, or raise the cap in settings`,
    );
  }

  // user edits from the approval screen win over the AI draft
  const subject = overrides.subject?.trim() || email.subject;
  const body = overrides.body?.trim() || email.body;

  const pdf = await storage.read(application.tailoredResumeKey);
  const company = application.job.company.replace(/[^a-z0-9]+/gi, "_");

  const sent = await sendGmail(userId, {
    to: application.recruiter.email,
    subject,
    body,
    attachment: {
      filename: `resume_${company}.pdf`,
      content: pdf,
      mimeType: "application/pdf",
    },
  });

  await db.email.update({
    where: { id: email.id },
    data: {
      subject,
      body,
      sentAt: new Date(),
      gmailMessageId: sent.gmailMessageId,
      gmailThreadId: sent.gmailThreadId,
    },
  });
  await transitionStatus(applicationId, "EMAIL_SENT", {
    type: "EMAIL_SENT",
    payload: { to: application.recruiter.email, subject },
  });

  logger.info({ applicationId, to: application.recruiter.email }, "cold email sent");
  return { sent: true, to: application.recruiter.email, subject, sentToday: sentToday + 1, cap };
}

/** Everything the approval/outreach screen needs in one shot. */
export async function getOutreach(userId: string, applicationId: string) {
  const application = await loadApplication(userId, applicationId);
  const email = await db.email.findUnique({
    where: { idempotencyKey: `${applicationId}:COLD` },
  });
  const linkedin = await db.linkedInMessage.findUnique({ where: { applicationId } });
  return {
    status: application.status,
    recruiter: application.recruiter,
    email,
    linkedin,
    job: { title: application.job.title, company: application.job.company },
  };
}

/** The user copied the LinkedIn message — record it for the tracker. */
export async function markLinkedInCopied(userId: string, applicationId: string) {
  const application = await loadApplication(userId, applicationId);
  const updated = await db.linkedInMessage.update({
    where: { applicationId: application.id },
    data: { copiedAt: new Date() },
  });
  await logEvent(applicationId, "LINKEDIN_COPIED");
  return updated;
}
