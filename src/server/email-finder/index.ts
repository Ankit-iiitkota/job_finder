import { logger } from "@/lib/logger";
import {
  applyPattern,
  COMMON_PATTERNS,
  detectPattern,
  ROLE_FALLBACKS,
  splitName,
} from "@/server/email-finder/patterns";
import { scrapeCompanyEmails } from "@/server/email-finder/scrape";
import { cleanDomain, domainAcceptsMail } from "@/server/email-finder/verify";

/**
 * The free email-finding pipeline (FEATURES.md §4) — replaces Hunter/Apollo:
 *   1. resolve/guess the company's mail domain (MX-checked)
 *   2. scrape public pages → real emails → learn the pattern
 *   3. generate candidates (recruiter name × patterns, role fallbacks)
 *   4. score confidence — the caller sends to the top candidate
 */

export type CandidateMethod =
  | "FOUND_ON_SITE"
  | "DISCOVERED_PATTERN"
  | "COMMON_PATTERN"
  | "ROLE_FALLBACK";

export interface EmailCandidate {
  email: string;
  confidence: number; // 0-100
  method: CandidateMethod;
  mxVerified: boolean;
}

export interface FindEmailInput {
  companyName: string;
  companyDomain?: string | null;
  recruiterName?: string | null;
}

export interface FindEmailResult {
  domain: string | null;
  candidates: EmailCandidate[]; // sorted best-first
}

/** No domain on record → derive guesses from the company name and MX-check them. */
async function discoverDomain(companyName: string): Promise<string | null> {
  const base = companyName
    .toLowerCase()
    .replace(/\b(inc|llc|ltd|gmbh|pvt|private|limited|corp|co|labs|technologies|technology|software|solutions)\b\.?/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
  if (base.length < 2) return null;

  for (const tld of ["com", "io", "co", "ai", "dev", "in"]) {
    const domain = `${base}.${tld}`;
    if (await domainAcceptsMail(domain)) return domain;
  }
  return null;
}

const CONFIDENCE: Record<CandidateMethod, number> = {
  FOUND_ON_SITE: 95,
  DISCOVERED_PATTERN: 80,
  COMMON_PATTERN: 60,
  ROLE_FALLBACK: 40,
};

const HIRING_LOCAL = /career|job|hr|talent|recruit|hiring/;
const GENERIC_LOCAL = /^(sales|info|support|press|media|hello|contact|team|office|admin|help|billing|legal|security)$/;

/**
 * Found-on-site emails are not all equal: careers@ IS the hiring channel (95),
 * a personal email proves the pattern and is a real inbox (90), but sales@ is
 * real yet the wrong audience for a job application (45 — below name guesses).
 */
function foundOnSiteConfidence(email: string): number {
  const local = email.split("@")[0];
  if (HIRING_LOCAL.test(local)) return 95;
  if (GENERIC_LOCAL.test(local)) return 45;
  return 90; // personal-looking mailbox
}

export async function findRecruiterEmail(input: FindEmailInput): Promise<FindEmailResult> {
  const domain = input.companyDomain
    ? cleanDomain(input.companyDomain)
    : await discoverDomain(input.companyName);

  if (!domain) {
    logger.warn({ company: input.companyName }, "no email domain discoverable");
    return { domain: null, candidates: [] };
  }

  const mxOk = await domainAcceptsMail(domain);
  const scraped = mxOk ? await scrapeCompanyEmails(domain) : [];
  const discoveredPattern = detectPattern(scraped);
  const name = input.recruiterName ? splitName(input.recruiterName) : null;

  const candidates = new Map<string, EmailCandidate>();
  const add = (email: string | null, method: CandidateMethod, baseConfidence?: number) => {
    if (!email || candidates.has(email)) return;
    const base = baseConfidence ?? CONFIDENCE[method];
    // MX failure caps confidence hard — a bounce hurts the user's sender score
    const confidence = mxOk ? base : Math.min(base, 15);
    candidates.set(email, { email, confidence, method, mxVerified: mxOk });
  };

  // 1. emails literally on the site (careers@ 95, personal 90, sales@/info@ 45)
  for (const email of scraped) add(email, "FOUND_ON_SITE", foundOnSiteConfidence(email));

  // 2. recruiter name × patterns (discovered pattern outranks common ones)
  if (name) {
    if (discoveredPattern) add(applyPattern(discoveredPattern, name, domain), "DISCOVERED_PATTERN");
    for (const pattern of COMMON_PATTERNS) {
      add(applyPattern(pattern, name, domain), "COMMON_PATTERN");
    }
  }

  // 3. role-based fallbacks always included as the floor
  for (const role of ROLE_FALLBACKS) add(`${role}@${domain}`, "ROLE_FALLBACK");

  const sorted = [...candidates.values()].sort((a, b) => b.confidence - a.confidence);
  logger.info(
    { domain, candidates: sorted.length, top: sorted[0]?.email, pattern: discoveredPattern },
    "email finding done",
  );
  return { domain, candidates: sorted };
}
