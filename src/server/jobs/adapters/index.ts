import type { JobSource } from "@/generated/prisma/client";
import type { JobSourceAdapter } from "@/server/jobs/types";
import { remoteOkAdapter } from "@/server/jobs/adapters/remoteok";
import { remotiveAdapter } from "@/server/jobs/adapters/remotive";
import { arbeitnowAdapter } from "@/server/jobs/adapters/arbeitnow";
import { hnHiringAdapter } from "@/server/jobs/adapters/hn-hiring";

/**
 * Adapter registry. Adding a job source = write the adapter file, add it here.
 * (Adzuna / Jooble / Greenhouse / Lever land in later phases.)
 */
export const jobSourceAdapters: JobSourceAdapter[] = [
  remoteOkAdapter,
  remotiveAdapter,
  arbeitnowAdapter,
  hnHiringAdapter, // YC-ecosystem jobs via "Ask HN: Who is Hiring"
];

export function getAdapters(sources?: JobSource[]): JobSourceAdapter[] {
  if (!sources || sources.length === 0) return jobSourceAdapters;
  return jobSourceAdapters.filter((a) => sources.includes(a.source));
}
