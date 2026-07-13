import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/errors";
import { requireUser } from "@/server/auth-guard";
import { getEmailVariantStats } from "@/server/services/ab-testing";

/** GET /api/dashboard/email-variants — reply rate per A/B tone variant. */
export const GET = apiHandler(async () => {
  const user = await requireUser();
  return NextResponse.json({ variants: await getEmailVariantStats(user.id) });
});
