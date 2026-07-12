import { JobSource } from "@/generated/prisma/client";
import { fetchJson } from "@/lib/http";
import { stripHtml } from "@/lib/html";
import type { JobSourceAdapter, NormalizedJob } from "@/server/jobs/types";

/**
 * Remotive — free public API (https://remotive.com/api/remote-jobs).
 * Supports server-side search → one request per query, deduped by id.
 */
interface RemotiveJob {
  id: number;
  url: string;
  title: string;
  company_name: string;
  tags?: string[];
  publication_date?: string;
  candidate_required_location?: string;
  description?: string;
}

interface RemotiveResponse {
  jobs: RemotiveJob[];
}

async function search(query?: string): Promise<RemotiveJob[]> {
  const url = new URL("https://remotive.com/api/remote-jobs");
  if (query) url.searchParams.set("search", query);
  url.searchParams.set("limit", "100");
  const data = await fetchJson<RemotiveResponse>(url.toString());
  return data.jobs ?? [];
}

export const remotiveAdapter: JobSourceAdapter = {
  source: JobSource.REMOTIVE,

  async fetch(queries: string[]): Promise<NormalizedJob[]> {
    const searches = queries.length > 0 ? queries : [undefined];
    const results = await Promise.all(searches.map((q) => search(q)));

    const byId = new Map<number, RemotiveJob>();
    for (const job of results.flat()) byId.set(job.id, job);

    return [...byId.values()].map(
      (job): NormalizedJob => ({
        source: JobSource.REMOTIVE,
        externalId: String(job.id),
        title: job.title,
        company: job.company_name,
        location: job.candidate_required_location || null,
        remote: true, // Remotive lists remote jobs only
        description: stripHtml(job.description ?? ""),
        tags: (job.tags ?? []).map((t) => t.toLowerCase()),
        sourceUrl: job.url,
        postedAt: job.publication_date ? new Date(job.publication_date) : null,
      }),
    );
  },
};
