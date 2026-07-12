import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/errors";
import { requireUser } from "@/server/auth-guard";
import {
  getProfileWithPrefs,
  profileUpdateSchema,
  updateProfile,
} from "@/server/services/profile";

/** GET /api/profile — the signed-in user's profile + outreach preferences. */
export const GET = apiHandler(async () => {
  const user = await requireUser();
  return NextResponse.json(await getProfileWithPrefs(user.id));
});

/** PUT /api/profile — update editable profile fields / preferences. */
export const PUT = apiHandler(async (request: Request) => {
  const user = await requireUser();
  const input = profileUpdateSchema.parse(await request.json());
  return NextResponse.json(await updateProfile(user.id, input));
});
