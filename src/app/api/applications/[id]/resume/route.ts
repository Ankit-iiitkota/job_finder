import { apiHandler } from "@/lib/errors";
import { requireUser } from "@/server/auth-guard";
import { getTailoredPdf } from "@/server/services/applications";
import { NextResponse } from "next/server";

/** GET /api/applications/:id/resume — download the tailored PDF. */
export const GET = apiHandler(
  async (_request: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireUser();
    const { id } = await ctx.params;

    const { pdf, filename } = await getTailoredPdf(user.id, id);
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  },
);
