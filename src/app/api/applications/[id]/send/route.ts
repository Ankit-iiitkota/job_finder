import { NextResponse } from "next/server";
import { z } from "zod";
import { apiHandler } from "@/lib/errors";
import { requireUser } from "@/server/auth-guard";
import { sendColdEmail } from "@/server/services/outreach";

/**
 * POST /api/applications/:id/send — send the cold email from the user's own
 * Gmail (tailored PDF attached). Optional body carries the user's edits from
 * the approval screen. Daily cap + already-sent guard enforced in the service.
 */
const bodySchema = z.object({
  subject: z.string().trim().min(3).max(120).optional(),
  body: z.string().trim().min(20).max(3000).optional(),
});

export const POST = apiHandler(
  async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireUser();
    const { id } = await ctx.params;

    const raw = await request.text();
    const overrides = bodySchema.parse(raw ? JSON.parse(raw) : {});

    return NextResponse.json(await sendColdEmail(user.id, id, overrides));
  },
);
