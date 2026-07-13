import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";

/**
 * Runaway-cost guard (FEATURES.md §9 security review): every LLM call in
 * this app is user-triggered, so a compromised session or a buggy retry
 * loop in the UI could otherwise burn through the free-tier daily quota. Caps
 * AI-triggering actions per user per day using the event log we already
 * write for the tracker timeline — no extra table needed.
 */
const DAILY_AI_CALL_CAP = 30;
const AI_EVENT_TYPES = ["RESUME_TAILORED", "OUTREACH_DRAFTED"];

function startOfUtcDay(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export async function assertAiCallBudget(userId: string): Promise<void> {
  const count = await db.applicationEvent.count({
    where: {
      type: { in: AI_EVENT_TYPES },
      application: { userId },
      createdAt: { gte: startOfUtcDay() },
    },
  });
  if (count >= DAILY_AI_CALL_CAP) {
    throw new AppError(
      "RATE_LIMITED",
      `Daily AI usage cap reached (${count}/${DAILY_AI_CALL_CAP}) — resumes tomorrow`,
    );
  }
}
