import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/errors";
import { requireUser } from "@/server/auth-guard";
import { getSkillGap } from "@/server/services/skill-gap";

/** GET /api/dashboard/skill-gap — most-requested skills missing from the profile. */
export const GET = apiHandler(async () => {
  const user = await requireUser();
  return NextResponse.json({ skillGap: await getSkillGap(user.id) });
});
