/**
 * Email pattern discovery + candidate generation (FEATURES.md §4).
 * Zero-cost replacement for Hunter/Apollo pattern data.
 */

export type EmailPattern =
  | "first.last"
  | "first"
  | "firstlast"
  | "f.last"
  | "first_last"
  | "flast";

export const COMMON_PATTERNS: EmailPattern[] = [
  "first.last",
  "first",
  "firstlast",
  "f.last",
  "first_last",
  "flast",
];

export const ROLE_FALLBACKS = ["careers", "jobs", "hr", "talent", "hello", "contact"];

/** Split "Priya Sharma" → { first: "priya", last: "sharma" } (ascii-folded). */
export function splitName(fullName: string): { first: string; last: string } | null {
  const clean = fullName
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .replace(/[^a-zA-Z\s'-]/g, "")
    .trim()
    .toLowerCase();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return null;
  const first = parts[0].replace(/[-']/g, "");
  const last = (parts.length > 1 ? parts[parts.length - 1] : "").replace(/[-']/g, "");
  if (first.length < 2) return null;
  return { first, last };
}

export function applyPattern(
  pattern: EmailPattern,
  name: { first: string; last: string },
  domain: string,
): string | null {
  const { first, last } = name;
  const local = (() => {
    switch (pattern) {
      case "first":
        return first;
      case "first.last":
        return last ? `${first}.${last}` : null;
      case "firstlast":
        return last ? `${first}${last}` : null;
      case "f.last":
        return last ? `${first[0]}.${last}` : null;
      case "first_last":
        return last ? `${first}_${last}` : null;
      case "flast":
        return last ? `${first[0]}${last}` : null;
    }
  })();
  return local ? `${local}@${domain}` : null;
}

/**
 * Learn the company's pattern from emails found on their site.
 * Heuristic: a personal-looking local part reveals the separator style.
 */
export function detectPattern(foundEmails: string[]): EmailPattern | null {
  for (const email of foundEmails) {
    const local = email.split("@")[0].toLowerCase();
    if (ROLE_FALLBACKS.includes(local) || /^(info|admin|support|noreply|no-reply|sales|team|office|mail|press)$/.test(local)) {
      continue; // generic inbox teaches us nothing about person-email format
    }
    if (/^[a-z]{2,}\.[a-z]{2,}$/.test(local)) return "first.last";
    if (/^[a-z]{2,}_[a-z]{2,}$/.test(local)) return "first_last";
    if (/^[a-z]\.[a-z]{2,}$/.test(local)) return "f.last";
  }
  return null;
}
