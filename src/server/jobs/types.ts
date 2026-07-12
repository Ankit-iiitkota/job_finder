import type { JobSource } from "@/generated/prisma/client";

/**
 * A job posting normalized to one common shape, regardless of which
 * platform it came from. Adapters translate source payloads into this.
 */
export interface NormalizedJob {
  source: JobSource;
  /** stable id from the source — powers @@unique([source, externalId]) dedupe */
  externalId: string;
  title: string;
  company: string;
  companyDomain?: string | null;
  location?: string | null;
  remote: boolean;
  /** plain-text JD (HTML stripped) */
  description: string;
  /** skill tags as provided by the source (lowercased) */
  tags: string[];
  salaryMin?: number | null;
  salaryMax?: number | null;
  sourceUrl: string;
  postedAt?: Date | null;
}

/**
 * Adapter pattern (FEATURES.md §4): every job source implements this.
 * Adding a new source = one new file, zero changes to the scanner.
 */
export interface JobSourceAdapter {
  readonly source: JobSource;
  /**
   * Fetch jobs for the given search queries. Sources without server-side
   * search fetch their feed once and filter locally. Must NEVER throw for
   * "no results" — only for genuine transport/parse failures (the scanner
   * isolates those with Promise.allSettled).
   */
  fetch(queries: string[]): Promise<NormalizedJob[]>;
}

/** Case-insensitive local filter used by adapters without server-side search. */
export function matchesAnyQuery(job: NormalizedJob, queries: string[]): boolean {
  if (queries.length === 0) return true;
  const haystack = `${job.title} ${job.tags.join(" ")}`.toLowerCase();
  return queries.some((q) => haystack.includes(q.toLowerCase()));
}
