import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/errors";
import { requireUser } from "@/server/auth-guard";
import { tailorApplication } from "@/server/services/applications";

/**
 * POST /api/applications/:id/tailor — run the AI tailoring pipeline:
 * JD analysis → tailored resume → fabrication guard → LaTeX → PDF → ATS score.
 * (n8n WF2 will call this in auto mode; users trigger it from the dashboard.)
 */
export const POST = apiHandler(
  async (_request: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireUser();
    const { id } = await ctx.params;

    const { tailored, ats } = await tailorApplication(user.id, id);
    return NextResponse.json({
      atsScore: ats.score,
      coveredKeywords: ats.coveredKeywords,
      missingKeywords: ats.missingKeywords,
      checks: ats.checks,
      jdAnalysis: tailored.jdAnalysis,
      resumeUrl: `/api/applications/${id}/resume`,
    });
  },
);
