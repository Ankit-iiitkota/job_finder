import { db } from "@/lib/db";

/**
 * Aggregate stats for the dashboard home (FEATURES.md F8).
 * Job counts are global (job discovery is shared across users); everything
 * else is scoped to the signed-in user.
 */
export interface DashboardStats {
  jobsFoundToday: number;
  jobsFoundThisWeek: number;
  applications: {
    total: number;
    byStatus: Record<string, number>;
  };
  emailsSent: number;
  repliesReceived: number;
  responseRate: number; // 0-1, 0 when no emails sent yet
  resumesGenerated: number;
  linkedinMessagesCopied: number;
}

function startOf(daysAgo: number): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d;
}

export async function getDashboardStats(userId: string): Promise<DashboardStats> {
  const [
    jobsFoundToday,
    jobsFoundThisWeek,
    applicationsByStatus,
    emailsSent,
    repliesReceived,
    resumesGenerated,
    linkedinMessagesCopied,
  ] = await Promise.all([
    db.job.count({ where: { scrapedAt: { gte: startOf(0) } } }),
    db.job.count({ where: { scrapedAt: { gte: startOf(6) } } }),
    db.application.groupBy({ by: ["status"], where: { userId }, _count: true }),
    db.email.count({ where: { application: { userId }, sentAt: { not: null } } }),
    db.email.count({ where: { application: { userId }, repliedAt: { not: null } } }),
    db.application.count({ where: { userId, tailoredResumeKey: { not: null } } }),
    db.linkedInMessage.count({
      where: { application: { userId }, copiedAt: { not: null } },
    }),
  ]);

  const byStatus: Record<string, number> = {};
  let total = 0;
  for (const row of applicationsByStatus) {
    byStatus[row.status] = row._count;
    total += row._count;
  }

  return {
    jobsFoundToday,
    jobsFoundThisWeek,
    applications: { total, byStatus },
    emailsSent,
    repliesReceived,
    responseRate: emailsSent > 0 ? Number((repliesReceived / emailsSent).toFixed(2)) : 0,
    resumesGenerated,
    linkedinMessagesCopied,
  };
}
