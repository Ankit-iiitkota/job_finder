import { JobSource } from "@/generated/prisma/client";
import { fetchJson } from "@/lib/http";
import { stripHtml } from "@/lib/html";
import type { JobSourceAdapter, NormalizedJob } from "@/server/jobs/types";

/**
 * YC / startup jobs via the monthly "Ask HN: Who is Hiring?" thread —
 * fetched through HN's free Algolia API (no key). Each top-level comment is
 * a job post, conventionally formatted "Company | Role | Location | ...".
 * This is the closest zero-cost source of YC-ecosystem jobs.
 */
interface AlgoliaHit {
  objectID: string;
  title?: string; // stories
  comment_text?: string; // comments (HTML)
  author?: string;
  created_at?: string;
  parent_id?: number;
  story_id?: number;
}

interface AlgoliaResponse {
  hits: AlgoliaHit[];
}

const API = "https://hn.algolia.com/api/v1";

async function findLatestHiringThread(): Promise<AlgoliaHit | null> {
  const data = await fetchJson<AlgoliaResponse>(
    `${API}/search_by_date?tags=story,author_whoishiring&hitsPerPage=10`,
  );
  return (
    data.hits.find((h) => h.title?.toLowerCase().includes("who is hiring")) ?? null
  );
}

/** "Company | Role | Location | …" → structured fields (best effort). */
function parsePost(text: string): {
  company: string;
  title: string;
  location: string | null;
  remote: boolean;
} | null {
  const firstLine = text.split("\n")[0]?.trim() ?? "";
  if (!firstLine.includes("|") || firstLine.length < 10) return null;

  const parts = firstLine.split("|").map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return null;

  const [company, ...rest] = parts;
  const roleIdx = rest.findIndex((p) =>
    /engineer|developer|designer|founding|scientist|manager|devops|full.?stack|frontend|backend|swe|intern/i.test(p),
  );
  const title = roleIdx >= 0 ? rest[roleIdx] : rest[0];
  const location =
    rest.find((p) => /remote|onsite|hybrid|[A-Z][a-z]+,\s*[A-Z]{2}/i.test(p)) ?? null;

  return {
    company: company.slice(0, 80),
    title: title.slice(0, 120),
    location,
    remote: /remote/i.test(firstLine),
  };
}

export const hnHiringAdapter: JobSourceAdapter = {
  source: JobSource.HN_HIRING,

  async fetch(queries: string[]): Promise<NormalizedJob[]> {
    const thread = await findLatestHiringThread();
    if (!thread) return [];

    const storyId = Number(thread.objectID);
    const data = await fetchJson<AlgoliaResponse>(
      `${API}/search_by_date?tags=comment,story_${storyId}&hitsPerPage=1000`,
    );

    const jobs: NormalizedJob[] = [];
    for (const hit of data.hits) {
      // top-level comments only — replies are discussion, not postings
      if (hit.parent_id !== storyId || !hit.comment_text) continue;

      const description = stripHtml(hit.comment_text);
      const parsed = parsePost(description);
      if (!parsed) continue;

      jobs.push({
        source: JobSource.HN_HIRING,
        externalId: hit.objectID,
        title: parsed.title,
        company: parsed.company,
        location: parsed.location,
        remote: parsed.remote,
        description,
        tags: [],
        sourceUrl: `https://news.ycombinator.com/item?id=${hit.objectID}`,
        postedAt: hit.created_at ? new Date(hit.created_at) : null,
      });
    }

    // HN posts carry no tags, so filter on the FULL text (not just title)
    if (queries.length === 0) return jobs;
    return jobs.filter((job) => {
      const haystack = `${job.title} ${job.description}`.toLowerCase();
      return queries.some((q) => haystack.includes(q.toLowerCase()));
    });
  },
};
