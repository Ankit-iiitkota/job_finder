import { logger } from "@/lib/logger";
import { safeFetch } from "@/lib/http";

/**
 * Step 1 of the free email pipeline: scrape the company's public pages for
 * any visible emails — they reveal the domain's email pattern, and sometimes
 * ARE the hiring contact (careers@/jobs@ on the careers page).
 */
const PATHS = ["/", "/contact", "/about", "/team", "/careers", "/jobs"];

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

/** things that match the regex but are not real inboxes */
const JUNK = /\.(png|jpe?g|gif|svg|webp|css|js)$|@(2x|3x)\b|example\.|sentry|wixpress/i;

export async function scrapeCompanyEmails(domain: string): Promise<string[]> {
  const found = new Set<string>();

  // sequential on purpose — safeFetch's per-host delay keeps us polite anyway
  for (const path of PATHS) {
    try {
      const response = await safeFetch(`https://${domain}${path}`, {
        timeoutMs: 8_000,
        retries: 0, // a 404 careers page is normal, don't waste retries
        headers: { "User-Agent": "Mozilla/5.0 (compatible; job-finder)" },
      });
      if (!response.ok) continue;

      const html = await response.text();
      for (const raw of html.match(EMAIL_RE) ?? []) {
        const email = raw.toLowerCase();
        if (JUNK.test(email)) continue;
        if (email.endsWith(`@${domain}`) || email.includes(`@${domain.replace(/^www\./, "")}`)) {
          found.add(email);
        }
      }
    } catch {
      // unreachable page — expected often, move on
    }
  }

  logger.info({ domain, found: found.size }, "company email scrape done");
  return [...found];
}
