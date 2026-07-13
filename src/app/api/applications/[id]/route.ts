import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/errors";
import { requireUser } from "@/server/auth-guard";
import { getApplicationDetail } from "@/server/services/application-detail";

/**
 * GET /api/applications/:id — full detail for the tracker drawer: job,
 * recruiter, emails, LinkedIn message, and the append-only event timeline.
 */
export const GET = apiHandler(
  async (_request: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireUser();
    const { id } = await ctx.params;
    return NextResponse.json(await getApplicationDetail(user.id, id));
  },
);
