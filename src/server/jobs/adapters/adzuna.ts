import { JobSource } from "@/generated/prisma/client";
import { env } from "@/lib/env";
import { fetchJson } from "@/lib/http";
import { stripHtml } from "@/lib/html";
import type { JobSourceAdapter, NormalizedJob } from "@/server/jobs/types";

/**
 * Adzuna — free tier (~250 calls/day), India + global coverage with real
 * salary data. Requires ADZUNA_APP_ID + ADZUNA_APP_KEY; skips silently if
 * unset (FEATURES.md §4: "adapters skip sources without keys").
 *
 * Response shape verified against the live API (not assumed from memory) —
 * see scripts/smoke-adapters.ts.
 */
interface AdzunaJob {
  id: string;
  title: string;
  description: string;
  redirect_url: string;
  created: string; // ISO timestamp
  company: { display_name: string };
  location: { display_name: string };
  salary_min?: number;
  salary_max?: number;
  contract_type?: string;
}

interface AdzunaResponse {
  results: AdzunaJob[];
}

const RESULTS_PER_PAGE = 50;

async function search(appId: string, appKey: string, query?: string): Promise<AdzunaJob[]> {
  const url = new URL(
    `https://api.adzuna.com/v1/api/jobs/${env.ADZUNA_COUNTRY}/search/1`,
  );
  url.searchParams.set("app_id", appId);
  url.searchParams.set("app_key", appKey);
  url.searchParams.set("results_per_page", String(RESULTS_PER_PAGE));
  url.searchParams.set("content-type", "application/json");
  if (query) url.searchParams.set("what", query);

  const data = await fetchJson<AdzunaResponse>(url.toString());
  return data.results ?? [];
}

function looksRemote(job: AdzunaJob): boolean {
  return /remote|work from home|\bwfh\b/i.test(`${job.title} ${job.location.display_name}`);
}

export const adzunaAdapter: JobSourceAdapter = {
  source: JobSource.ADZUNA,

  async fetch(queries: string[]): Promise<NormalizedJob[]> {
    const { ADZUNA_APP_ID: appId, ADZUNA_APP_KEY: appKey } = env;
    if (!appId || !appKey) return []; // not configured — silent skip, per adapter contract

    const searches = queries.length > 0 ? queries : [undefined];
    const results = await Promise.all(searches.map((q) => search(appId, appKey, q)));

    const byId = new Map<string, AdzunaJob>();
    for (const job of results.flat()) byId.set(job.id, job);

    return [...byId.values()].map(
      (job): NormalizedJob => ({
        source: JobSource.ADZUNA,
        externalId: job.id,
        title: job.title,
        company: job.company.display_name,
        location: job.location.display_name || null,
        remote: looksRemote(job),
        description: stripHtml(job.description),
        tags: job.contract_type ? [job.contract_type] : [],
        salaryMin: job.salary_min ? Math.round(job.salary_min) : null,
        salaryMax: job.salary_max ? Math.round(job.salary_max) : null,
        sourceUrl: job.redirect_url,
        postedAt: job.created ? new Date(job.created) : null,
      }),
    );
  },
};
