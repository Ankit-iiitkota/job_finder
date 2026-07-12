import type { ApplicationStatus, Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";

/**
 * Append-only audit trail (FEATURES.md §5) — every status transition and
 * meaningful action lands here; the dashboard timeline reads it back.
 */
export async function transitionStatus(
  applicationId: string,
  status: ApplicationStatus,
  extra?: { type?: string; payload?: Prisma.InputJsonValue },
): Promise<void> {
  await db.$transaction([
    db.application.update({ where: { id: applicationId }, data: { status } }),
    db.applicationEvent.create({
      data: {
        applicationId,
        type: extra?.type ?? "STATUS_CHANGED",
        payload: { status, ...(extra?.payload ? { detail: extra.payload } : {}) },
      },
    }),
  ]);
}

export async function logEvent(
  applicationId: string,
  type: string,
  payload?: Prisma.InputJsonValue,
): Promise<void> {
  await db.applicationEvent.create({ data: { applicationId, type, payload } });
}
