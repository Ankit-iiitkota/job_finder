import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/errors";
import { requireUser } from "@/server/auth-guard";
import { getDashboardStats } from "@/server/services/dashboard";

/** GET /api/dashboard/stats — the numbers behind the dashboard home. */
export const GET = apiHandler(async () => {
  const user = await requireUser();
  return NextResponse.json(await getDashboardStats(user.id));
});
