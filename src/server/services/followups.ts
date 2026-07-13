import { EmailType } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { sendGmail } from "@/lib/gmail";
import { transitionStatus } from "@/server/services/events";

/**
 * Follow-up engine (FEATURES.md F7) — invoked daily by n8n WF5.
 *
 * Ladder: EMAIL_SENT --7d no reply--> FOLLOWUP_1 --7d--> FOLLOWUP_2 --7d--> NO_RESPONSE
 *
 * Design notes:
 *  - Follow-ups are TEMPLATED, not AI-drafted: a bump email is formulaic by
 *    nature; deterministic templates cost zero tokens and can't hallucinate.
 *  - Threaded into the original conversation via gmailThreadId + "Re:" subject.
 *  - Idempotency: the email row (unique `applicationId:FOLLOWUP_n`) is created
 *    BEFORE sending with sentAt=null; a crash between create and send leaves a
 *    row the next run completes. sentAt set = never sent again.
 *  - Batch-limited + jittered delays so a big backlog neither times the
 *    request out nor looks like a burst to Gmail.
 */

const FOLLOW_UP_AFTER_DAYS = 7;
const MAX_SENDS_PER_RUN = 20;

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function followUpBody(
  n: 1 | 2,
  ctx: { recruiterName: string | null; role: string; company: string; candidateName: string },
): string {
  const greeting = ctx.recruiterName ? `Hi ${ctx.recruiterName.split(" ")[0]},` : "Hi,";
  if (n === 1) {
    return [
      greeting,
      "",
      `Just floating my application for the ${ctx.role} role at ${ctx.company} back to the top of your inbox — I know hiring weeks get busy.`,
      "",
      `Happy to share anything else that would help evaluate fit. My tailored resume is on the earlier email in this thread.`,
      "",
      `Best,`,
      ctx.candidateName,
    ].join("\n");
  }
  return [
    greeting,
    "",
    `Closing the loop on the ${ctx.role} role — if the position is filled or I'm not the right fit, no reply needed and thanks for your time.`,
    "",
    `If it's still open, I'd love to talk.`,
    "",
    `Best,`,
    ctx.candidateName,
  ].join("\n");
}

export interface FollowupRunResult {
  followup1Sent: number;
  followup2Sent: number;
  closedNoResponse: number;
  skipped: number;
  errors: number;
}

export async function processFollowups(): Promise<FollowupRunResult> {
  const result: FollowupRunResult = {
    followup1Sent: 0,
    followup2Sent: 0,
    closedNoResponse: 0,
    skipped: 0,
    errors: 0,
  };

  const candidates = await db.application.findMany({
    where: {
      status: { in: ["EMAIL_SENT", "FOLLOWUP_1", "FOLLOWUP_2"] },
      emails: { none: { repliedAt: { not: null } } }, // any reply stops the ladder
    },
    include: {
      emails: true,
      recruiter: true,
      job: { select: { title: true, company: true } },
      user: { select: { id: true, name: true, dailyEmailCap: true } },
    },
    take: 200,
  });

  const cutoff = daysAgo(FOLLOW_UP_AFTER_DAYS);
  let sends = 0;

  for (const app of candidates) {
    if (sends >= MAX_SENDS_PER_RUN) break;
    try {
      const cold = app.emails.find((e) => e.type === EmailType.COLD && e.sentAt);
      const f1 = app.emails.find((e) => e.type === EmailType.FOLLOWUP_1 && e.sentAt);
      const f2 = app.emails.find((e) => e.type === EmailType.FOLLOWUP_2 && e.sentAt);
      if (!cold?.gmailThreadId || !app.recruiter) continue;

      // which rung of the ladder is due?
      let next: { n: 1 | 2; type: EmailType } | "close" | null = null;
      if (app.status === "EMAIL_SENT" && cold.sentAt! <= cutoff) {
        next = { n: 1, type: EmailType.FOLLOWUP_1 };
      } else if (app.status === "FOLLOWUP_1" && f1 && f1.sentAt! <= cutoff) {
        next = { n: 2, type: EmailType.FOLLOWUP_2 };
      } else if (app.status === "FOLLOWUP_2" && f2 && f2.sentAt! <= cutoff) {
        next = "close";
      }
      if (!next) {
        result.skipped++;
        continue;
      }

      if (next === "close") {
        await transitionStatus(app.id, "NO_RESPONSE", { type: "CLOSED_NO_RESPONSE" });
        result.closedNoResponse++;
        continue;
      }

      const body = followUpBody(next.n, {
        recruiterName: app.recruiter.name,
        role: app.job.title,
        company: app.job.company,
        candidateName: app.user.name ?? "the candidate",
      });
      const subject = `Re: ${cold.subject}`;

      // idempotent create-then-send (see module docs)
      const email = await db.email.upsert({
        where: { idempotencyKey: `${app.id}:${next.type}` },
        create: {
          applicationId: app.id,
          type: next.type,
          subject,
          body,
          idempotencyKey: `${app.id}:${next.type}`,
        },
        update: {},
      });
      if (email.sentAt) {
        result.skipped++;
        continue;
      }

      const sent = await sendGmail(app.user.id, {
        to: app.recruiter.email,
        subject,
        body,
        threadId: cold.gmailThreadId,
      });

      await db.email.update({
        where: { id: email.id },
        data: {
          sentAt: new Date(),
          gmailMessageId: sent.gmailMessageId,
          gmailThreadId: sent.gmailThreadId,
        },
      });
      await transitionStatus(app.id, next.n === 1 ? "FOLLOWUP_1" : "FOLLOWUP_2", {
        type: "FOLLOWUP_SENT",
        payload: { n: next.n, to: app.recruiter.email },
      });

      if (next.n === 1) result.followup1Sent++;
      else result.followup2Sent++;
      sends++;

      // human-like jitter between sends (1–4s)
      await sleep(1_000 + Math.random() * 3_000);
    } catch (error) {
      result.errors++;
      logger.error({ applicationId: app.id, err: error }, "follow-up failed");
    }
  }

  logger.info(result, "follow-up run finished");
  return result;
}
