import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/errors";
import { listJobs, listJobsQuerySchema } from "@/server/services/jobs";

/**
 * GET /api/jobs — search / filter / paginate stored jobs.
 *   ?q=react&source=REMOTEOK&remote=true&page=1&pageSize=20
 */
export const GET = apiHandler(async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const query = listJobsQuerySchema.parse(Object.fromEntries(searchParams));
  return NextResponse.json(await listJobs(query));
});
