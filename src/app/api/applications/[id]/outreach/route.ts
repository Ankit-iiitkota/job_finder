import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/errors";
import { requireUser } from "@/server/auth-guard";
import {
  draftApplicationOutreach,
  getOutreach,
} from "@/server/services/outreach";

/** GET /api/applications/:id/outreach — drafts + recruiter for the approval screen. */
export const GET = apiHandler(
  async (_request: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireUser();
    const { id } = await ctx.params;
    return NextResponse.json(await getOutreach(user.id, id));
  },
);

/**
 * POST /api/applications/:id/outreach — (re)draft the outreach kit with AI:
 * cold email + LinkedIn connection note + LinkedIn DM. Nothing is sent.
 */
export const POST = apiHandler(
  async (_request: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireUser();
    const { id } = await ctx.params;
    return NextResponse.json(await draftApplicationOutreach(user.id, id));
  },
);
