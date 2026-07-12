import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/errors";
import { requireUser } from "@/server/auth-guard";
import { markLinkedInCopied } from "@/server/services/outreach";

/**
 * POST /api/applications/:id/linkedin-copied — the user copied the LinkedIn
 * message to send manually (we never automate LinkedIn — ToS). Recorded for
 * the tracker timeline.
 */
export const POST = apiHandler(
  async (_request: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireUser();
    const { id } = await ctx.params;
    return NextResponse.json(await markLinkedInCopied(user.id, id));
  },
);
