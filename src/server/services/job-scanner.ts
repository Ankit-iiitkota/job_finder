import { JobSource } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { getAdapters } from "@/server/jobs/adapters";
import type { NormalizedJob } from "@/server/jobs/types";

/**
 * Job scan service — the engine behind n8n workflow WF1.
 *
 * Design (FEATURES.md §7 Phase 2):
 *  - all adapters fetched in PARALLEL via Promise.allSettled: one broken
 *    source degrades the scan, never kills it
 *  - freshness filter: only recently posted jobs (default 72h) — early
 *    applicants get seen first
 *  - dedupe twice: in-memory Map by (source, externalId) within the batch,
 *    then `createMany({ skipDuplicates: true })` against the DB unique index
 */

export interface ScanOptions {
  /** search keywords, e.g. ["react", "frontend developer"] */
  queries?: string[];
  /** only keep jobs posted within this window (default 72h) */
  maxAgeHours?: number;
  /** restrict to specific sources; default = all registered adapters */
  sources?: JobSource[];
}

export interface ScanResult {
  fetched: number;
  fresh: number;
  inserted: number;
  bySource: Record<string, { fetched: number } | { error: string }>;
  durationMs: number;
}

export async function scanJobs(options: ScanOptions = {}): Promise<ScanResult> {
  const { queries = [], maxAgeHours = 72, sources } = options;
  const startedAt = Date.now();
  const adapters = getAdapters(sources);

  const settled = await Promise.allSettled(
    adapters.map((adapter) => adapter.fetch(queries)),
  );

  const bySource: ScanResult["bySource"] = {};
  const all: NormalizedJob[] = [];

  settled.forEach((result, i) => {
    const source = adapters[i].source;
    if (result.status === "fulfilled") {
      bySource[source] = { fetched: result.value.length };
      all.push(...result.value);
    } else {
      const message =
        result.reason instanceof Error ? result.reason.message : String(result.reason);
      bySource[source] = { error: message };
      logger.error({ source, err: result.reason }, "job source failed during scan");
    }
  });

  // freshness filter — jobs without a postedAt are kept (can't judge them)
  const cutoff = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
  const fresh = all.filter((job) => !job.postedAt || job.postedAt >= cutoff);

  // in-memory dedupe within the batch
  const unique = new Map<string, NormalizedJob>();
  for (const job of fresh) unique.set(`${job.source}:${job.externalId}`, job);

  const { count: inserted } = await db.job.createMany({
    data: [...unique.values()].map((job) => ({
      source: job.source,
      externalId: job.externalId,
      title: job.title,
      company: job.company,
      companyDomain: job.companyDomain ?? null,
      location: job.location ?? null,
      remote: job.remote,
      description: job.description,
      salaryMin: job.salaryMin ?? null,
      salaryMax: job.salaryMax ?? null,
      sourceUrl: job.sourceUrl,
      postedAt: job.postedAt ?? null,
    })),
    skipDuplicates: true, // DB unique index (source, externalId) is the last line of defense
  });

  const result: ScanResult = {
    fetched: all.length,
    fresh: fresh.length,
    inserted,
    bySource,
    durationMs: Date.now() - startedAt,
  };

  logger.info(result, "job scan finished");
  return result;
}
