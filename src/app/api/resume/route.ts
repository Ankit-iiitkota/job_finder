import { NextResponse } from "next/server";
import { apiHandler, AppError } from "@/lib/errors";
import { requireUser } from "@/server/auth-guard";
import { ingestResume, MAX_RESUME_BYTES } from "@/server/services/resume-ingest";

/**
 * POST /api/resume — upload a resume (multipart form, field name "file").
 * Runs the full ingestion pipeline and returns the parsed master profile.
 */
export const POST = apiHandler(async (request: Request) => {
  const user = await requireUser();

  const form = await request.formData().catch(() => {
    throw new AppError("BAD_REQUEST", "Expected multipart/form-data with a 'file' field");
  });

  const file = form.get("file");
  if (!(file instanceof File)) {
    throw new AppError("BAD_REQUEST", "Missing 'file' field");
  }
  if (file.size > MAX_RESUME_BYTES) {
    throw new AppError("BAD_REQUEST", "Resume must be smaller than 5 MB");
  }

  const parsed = await ingestResume(user.id, {
    bytes: Buffer.from(await file.arrayBuffer()),
    mimeType: file.type,
  });

  return NextResponse.json({ parsed });
});
