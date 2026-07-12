/**
 * Explainable job↔profile match scoring (0–100).
 *
 * Deliberately NOT an LLM call: it runs on every job × every user during
 * scans, so it must be fast, free, and deterministic. Weighted keyword
 * overlap is transparent — we can show the user exactly WHY a job matched.
 *
 * Weights: keyword in title ×3, in tags ×2, in description ×1.
 */

export interface MatchInput {
  title: string;
  description: string;
  tags?: string[];
}

export interface MatchResult {
  score: number; // 0-100
  matched: string[]; // which of the user's keywords were found
  missing: string[]; // which weren't (feeds the future skill-gap feature)
}

const TITLE_WEIGHT = 3;
const TAG_WEIGHT = 2;
const DESCRIPTION_WEIGHT = 1;
const MAX_PER_KEYWORD = TITLE_WEIGHT + TAG_WEIGHT + DESCRIPTION_WEIGHT;

/** Escape a user keyword for safe use inside a RegExp. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Whole-word match so "java" doesn't match "javascript". */
function containsKeyword(text: string, keyword: string): boolean {
  return new RegExp(`(^|[^a-z0-9+#.])${escapeRegExp(keyword)}($|[^a-z0-9+#.])`, "i").test(
    text,
  );
}

export function computeMatchScore(
  keywords: string[],
  job: MatchInput,
): MatchResult {
  const cleaned = [...new Set(keywords.map((k) => k.trim().toLowerCase()).filter(Boolean))];
  if (cleaned.length === 0) return { score: 0, matched: [], missing: [] };

  const title = job.title.toLowerCase();
  const description = job.description.toLowerCase();
  const tags = (job.tags ?? []).join(" ").toLowerCase();

  let points = 0;
  const matched: string[] = [];
  const missing: string[] = [];

  for (const keyword of cleaned) {
    let keywordPoints = 0;
    if (containsKeyword(title, keyword)) keywordPoints += TITLE_WEIGHT;
    if (containsKeyword(tags, keyword)) keywordPoints += TAG_WEIGHT;
    if (containsKeyword(description, keyword)) keywordPoints += DESCRIPTION_WEIGHT;

    points += keywordPoints;
    (keywordPoints > 0 ? matched : missing).push(keyword);
  }

  const score = Math.round((points / (cleaned.length * MAX_PER_KEYWORD)) * 100);
  return { score: Math.min(100, score), matched, missing };
}
