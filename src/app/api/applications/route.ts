import { NextResponse } from "next/server";
import { z } from "zod";
import { apiHandler } from "@/lib/errors";
import { requireUser } from "@/server/auth-guard";
import { createApplication, listApplications } from "@/server/services/applications";

/** POST /api/applications — start an application for a stored job. */
const createSchema = z.object({ jobId: z.string().min(1) });

export const POST = apiHandler(async (request: Request) => {
  const user = await requireUser();
  const { jobId } = createSchema.parse(await request.json());
  const application = await createApplication(user.id, jobId);
  return NextResponse.json(application, { status: 201 });
});

/** GET /api/applications — the signed-in user's applications with job info. */
export const GET = apiHandler(async () => {
  const user = await requireUser();
  return NextResponse.json({ applications: await listApplications(user.id) });
});
