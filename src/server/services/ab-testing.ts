import { db } from "@/lib/db";

/**
 * A/B testing for cold email tone (FEATURES.md upgrade F4: "A/B test email
 * templates, auto-prefer the winner"). Hashing the application id gives a
 * deterministic, stable bucket without a separate experiments table — the
 * same application always drafts the same variant, even across redrafts.
 */
export type EmailVariant = "concise" | "warm";

export function assignEmailVariant(applicationId: string): EmailVariant {
  let hash = 0;
  for (let i = 0; i < applicationId.length; i++) {
    hash = (hash * 31 + applicationId.charCodeAt(i)) >>> 0;
  }
  return hash % 2 === 0 ? "concise" : "warm";
}

export interface VariantStats {
  variant: string;
  sent: number;
  replied: number;
  replyRate: number;
}

/** Reply rate per variant, best-performing first — "auto-prefer the winner" starts with visibility. */
export async function getEmailVariantStats(userId: string): Promise<VariantStats[]> {
  const sentByVariant = await db.email.groupBy({
    by: ["variant"],
    where: { application: { userId }, type: "COLD", sentAt: { not: null } },
    _count: { _all: true },
  });

  const stats = await Promise.all(
    sentByVariant
      .filter((row) => row.variant !== null)
      .map(async (row) => {
        const replied = await db.email.count({
          where: {
            application: { userId },
            type: "COLD",
            variant: row.variant,
            repliedAt: { not: null },
          },
        });
        const sent = row._count._all;
        return {
          variant: row.variant!,
          sent,
          replied,
          replyRate: sent > 0 ? Number((replied / sent).toFixed(2)) : 0,
        };
      }),
  );

  return stats.sort((a, b) => b.replyRate - a.replyRate);
}
