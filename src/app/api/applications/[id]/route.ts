import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiHandler, AppError } from "@/lib/errors";
import { requireUser } from "@/server/auth-guard";

/**
 * GET /api/applications/:id — full detail for the tracker drawer: job,
 * recruiter, emails, LinkedIn message, and the append-only event timeline.
 */
export const GET = apiHandler(
  async (_request: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireUser();
    const { id } = await ctx.params;

    const application = await db.application.findFirst({
      where: { id, userId: user.id },
      include: {
        job: true,
        recruiter: true,
        emails: { orderBy: { createdAt: "asc" } },
        linkedinMessage: true,
        events: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!application) throw new AppError("NOT_FOUND", "Application not found");

    return NextResponse.json(application);
  },
);
