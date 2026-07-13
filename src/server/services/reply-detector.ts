import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { safeFetch } from "@/lib/http";
import { getGmailAccessToken } from "@/lib/gmail";
import { transitionStatus } from "@/server/services/events";

/**
 * Reply detector (FEATURES.md F7) — invoked every ~15 min by n8n WF6.
 *
 * For every sent-but-unanswered email we check its Gmail THREAD: any message
 * in the thread not sent by the user = the recruiter replied. On reply:
 * repliedAt stamped, unsent follow-ups deleted (ladder cancelled), status →
 * REPLIED. Grouped per user so each user's token is fetched once.
 */

interface GmailThread {
  messages?: {
    id: string;
    labelIds?: string[];
    payload?: { headers?: { name: string; value: string }[] };
  }[];
}

const LOOKBACK_DAYS = 30;
const MAX_THREADS_PER_RUN = 100;

function headerValue(msg: NonNullable<GmailThread["messages"]>[number], name: string): string {
  return (
    msg.payload?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? ""
  );
}

export interface ReplyRunResult {
  checked: number;
  repliesFound: number;
  followupsCancelled: number;
  errors: number;
}

export async function detectReplies(): Promise<ReplyRunResult> {
  const result: ReplyRunResult = {
    checked: 0,
    repliesFound: 0,
    followupsCancelled: 0,
    errors: 0,
  };

  const lookback = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const emails = await db.email.findMany({
    where: {
      sentAt: { gte: lookback },
      repliedAt: null,
      gmailThreadId: { not: null },
      application: { status: { in: ["EMAIL_SENT", "FOLLOWUP_1", "FOLLOWUP_2"] } },
    },
    // one thread per application is enough — the cold email carries the thread
    distinct: ["applicationId"],
    orderBy: { sentAt: "asc" },
    take: MAX_THREADS_PER_RUN,
    include: {
      application: {
        select: { id: true, userId: true, user: { select: { email: true } } },
      },
    },
  });

  // group by user → one access token per user
  const byUser = new Map<string, typeof emails>();
  for (const email of emails) {
    const list = byUser.get(email.application.userId) ?? [];
    list.push(email);
    byUser.set(email.application.userId, list);
  }

  for (const [userId, userEmails] of byUser) {
    let accessToken: string;
    try {
      accessToken = await getGmailAccessToken(userId);
    } catch (error) {
      result.errors += userEmails.length;
      logger.warn({ userId, err: error }, "reply check skipped — gmail token unavailable");
      continue;
    }
    const userAddress = userEmails[0].application.user.email.toLowerCase();

    for (const email of userEmails) {
      result.checked++;
      try {
        const response = await safeFetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/threads/${email.gmailThreadId}?format=metadata&metadataHeaders=From`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
            timeoutMs: 15_000,
            retries: 1,
            perHostDelayMs: 250,
          },
        );
        if (!response.ok) {
          result.errors++;
          continue;
        }

        const thread = (await response.json()) as GmailThread;
        const reply = thread.messages?.find((msg) => {
          const from = headerValue(msg, "From").toLowerCase();
          return from.length > 0 && !from.includes(userAddress);
        });
        if (!reply) continue;

        const applicationId = email.application.id;
        const [, cancelled] = await db.$transaction([
          db.email.update({ where: { id: email.id }, data: { repliedAt: new Date() } }),
          // cancel the rest of the ladder — never bump someone who answered
          db.email.deleteMany({ where: { applicationId, sentAt: null } }),
        ]);
        await transitionStatus(applicationId, "REPLIED", {
          type: "REPLY_DETECTED",
          payload: { threadId: email.gmailThreadId },
        });

        result.repliesFound++;
        result.followupsCancelled += cancelled.count;
      } catch (error) {
        result.errors++;
        logger.error({ emailId: email.id, err: error }, "reply check failed");
      }
    }
  }

  logger.info(result, "reply detection run finished");
  return result;
}
