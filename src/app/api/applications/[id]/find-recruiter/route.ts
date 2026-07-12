import { NextResponse } from "next/server";
import { z } from "zod";
import { apiHandler } from "@/lib/errors";
import { requireUser } from "@/server/auth-guard";
import { findRecruiterForApplication } from "@/server/services/recruiter-finder";

/**
 * POST /api/applications/:id/find-recruiter — run the free email pipeline
 * (site scrape → pattern discovery → candidates → MX check → confidence).
 * Optional body: { recruiterName } when the job post names the hiring person.
 */
const bodySchema = z.object({
  recruiterName: z.string().trim().min(2).max(80).optional(),
});

export const POST = apiHandler(
  async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireUser();
    const { id } = await ctx.params;

    const raw = await request.text();
    const body = bodySchema.parse(raw ? JSON.parse(raw) : {});

    const result = await findRecruiterForApplication(user.id, id, body);
    return NextResponse.json(result);
  },
);
