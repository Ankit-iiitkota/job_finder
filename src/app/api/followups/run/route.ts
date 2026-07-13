import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/errors";
import { assertWebhookSecret } from "@/lib/webhook";
import { processFollowups } from "@/server/services/followups";

/**
 * POST /api/followups/run — n8n WF5 (daily cron).
 * Sends due follow-ups (7d ladder, max 2) and closes NO_RESPONSE.
 */
export const POST = apiHandler(async (request: Request) => {
  assertWebhookSecret(request);
  return NextResponse.json(await processFollowups());
});
