import { NextResponse } from "next/server";
import { z } from "zod";
import { JobSource } from "@/generated/prisma/client";
import { apiHandler } from "@/lib/errors";
import { assertWebhookSecret } from "@/lib/webhook";
import { scanJobs } from "@/server/services/job-scanner";

/**
 * POST /api/jobs/scan — trigger a job scan across all (or selected) sources.
 * Called by n8n WF1 on a cron, or manually during development.
 * Protected by the shared webhook secret.
 */
const scanRequestSchema = z.object({
  queries: z.array(z.string().min(1)).max(10).optional(),
  maxAgeHours: z.number().int().min(1).max(24 * 30).optional(),
  sources: z.array(z.enum(JobSource)).optional(),
});

export const POST = apiHandler(async (request: Request) => {
  assertWebhookSecret(request);

  // an empty body is valid — scan everything with defaults
  const raw = await request.text();
  const body = scanRequestSchema.parse(raw ? JSON.parse(raw) : {});

  const result = await scanJobs(body);
  return NextResponse.json(result);
});
