import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/errors";
import { assertWebhookSecret } from "@/lib/webhook";
import { detectReplies } from "@/server/services/reply-detector";

/**
 * POST /api/replies/check — n8n WF6 (cron every ~15 min).
 * Polls Gmail threads for replies; cancels pending follow-ups on reply.
 */
export const POST = apiHandler(async (request: Request) => {
  assertWebhookSecret(request);
  return NextResponse.json(await detectReplies());
});
