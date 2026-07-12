import { JobSource } from "@/generated/prisma/client";
import { fetchJson } from "@/lib/http";
import { stripHtml } from "@/lib/html";
import {
  matchesAnyQuery,
  type JobSourceAdapter,
  type NormalizedJob,
} from "@/server/jobs/types";

/**
 * Arbeitnow — free public job board API (https://www.arbeitnow.com/api/job-board-api).
 * Paginated feed, no search parameter → fetch first pages, filter locally.
 */
interface ArbeitnowJob {
  slug: string;
  company_name: string;
  title: string;
  description?: string;
  remote?: boolean;
  url: string;
  tags?: string[];
  location?: string;
  created_at?: number; // unix seconds
}

interface ArbeitnowResponse {
  data: ArbeitnowJob[];
  links?: { next?: string | null };
}

const PAGES_TO_FETCH = 3; // ~300 newest jobs; the freshness filter trims the rest

export const arbeitnowAdapter: JobSourceAdapter = {
  source: JobSource.ARBEITNOW,

  async fetch(queries: string[]): Promise<NormalizedJob[]> {
    const jobs: ArbeitnowJob[] = [];
    let url: string | null = "https://www.arbeitnow.com/api/job-board-api";

    for (let page = 0; page < PAGES_TO_FETCH && url; page++) {
      const data: ArbeitnowResponse = await fetchJson<ArbeitnowResponse>(url);
      jobs.push(...(data.data ?? []));
      url = data.links?.next ?? null;
    }

    return jobs
      .filter((job) => job.slug && job.title && job.company_name)
      .map(
        (job): NormalizedJob => ({
          source: JobSource.ARBEITNOW,
          externalId: job.slug,
          title: job.title,
          company: job.company_name,
          location: job.location || null,
          remote: job.remote ?? false,
          description: stripHtml(job.description ?? ""),
          tags: (job.tags ?? []).map((t) => t.toLowerCase()),
          sourceUrl: job.url,
          postedAt: job.created_at ? new Date(job.created_at * 1000) : null,
        }),
      )
      .filter((job) => matchesAnyQuery(job, queries));
  },
};
