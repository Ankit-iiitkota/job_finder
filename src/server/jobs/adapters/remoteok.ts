import { JobSource } from "@/generated/prisma/client";
import { fetchJson } from "@/lib/http";
import { stripHtml } from "@/lib/html";
import {
  matchesAnyQuery,
  type JobSourceAdapter,
  type NormalizedJob,
} from "@/server/jobs/types";

/**
 * RemoteOK — free public JSON feed (https://remoteok.com/api).
 * No search parameter → fetch the feed once, filter locally.
 * The first array element is a legal notice, not a job.
 */
interface RemoteOkItem {
  id?: string | number;
  position?: string;
  company?: string;
  tags?: string[];
  description?: string;
  location?: string;
  salary_min?: number;
  salary_max?: number;
  url?: string;
  date?: string; // ISO timestamp
}

export const remoteOkAdapter: JobSourceAdapter = {
  source: JobSource.REMOTEOK,

  async fetch(queries: string[]): Promise<NormalizedJob[]> {
    const items = await fetchJson<RemoteOkItem[]>("https://remoteok.com/api", {
      headers: { "User-Agent": "job-finder (github.com/Ankit-iiitkota/job_finder)" },
    });

    return items
      .filter((item) => item.id != null && item.position && item.company)
      .map(
        (item): NormalizedJob => ({
          source: JobSource.REMOTEOK,
          externalId: String(item.id),
          title: item.position!,
          company: item.company!,
          location: item.location || null,
          remote: true, // RemoteOK lists remote jobs only
          description: stripHtml(item.description ?? ""),
          tags: (item.tags ?? []).map((t) => t.toLowerCase()),
          salaryMin: item.salary_min || null,
          salaryMax: item.salary_max || null,
          sourceUrl: item.url ?? `https://remoteok.com/l/${item.id}`,
          postedAt: item.date ? new Date(item.date) : null,
        }),
      )
      .filter((job) => matchesAnyQuery(job, queries));
  },
};
