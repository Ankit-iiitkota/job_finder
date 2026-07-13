import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Full application detail — job, recruiter, emails, LinkedIn message, and
 * the append-only event timeline. Shared by the API route (client refetches
 * after each action) and the detail page (server-rendered initial load).
 */
const detailArgs = {
  include: {
    job: true,
    recruiter: true,
    emails: { orderBy: { createdAt: "asc" } },
    linkedinMessage: true,
    events: { orderBy: { createdAt: "asc" } },
  },
} satisfies Prisma.ApplicationDefaultArgs;

export type ApplicationDetail = Prisma.ApplicationGetPayload<typeof detailArgs>;

export async function getApplicationDetail(
  userId: string,
  applicationId: string,
): Promise<ApplicationDetail> {
  const application = await db.application.findFirst({
    where: { id: applicationId, userId },
    ...detailArgs,
  });
  if (!application) throw new AppError("NOT_FOUND", "Application not found");
  return application;
}
