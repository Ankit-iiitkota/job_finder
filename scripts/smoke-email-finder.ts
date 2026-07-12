/**
 * Smoke test: run the free email-finding pipeline against a real company.
 * Usage: npx tsx scripts/smoke-email-finder.ts [companyName] [recruiterName]
 * No DB needed — exercises domain discovery, site scraping, patterns, MX.
 */
import "dotenv/config";
import { findRecruiterEmail } from "@/server/email-finder";

const companyName = process.argv[2] ?? "PostHog";
const recruiterName = process.argv[3] ?? "Priya Sharma";

async function main() {
  const started = Date.now();
  const { domain, candidates } = await findRecruiterEmail({
    companyName,
    recruiterName,
  });

  console.log(`\ncompany: ${companyName} → domain: ${domain ?? "NOT FOUND"}`);
  console.log(`candidates (${candidates.length}) in ${Date.now() - started}ms:\n`);
  for (const c of candidates.slice(0, 10)) {
    console.log(
      `  ${String(c.confidence).padStart(3)}/100  ${c.email.padEnd(35)} ${c.method}${c.mxVerified ? " (MX ok)" : ""}`,
    );
  }
  if (candidates.length === 0) process.exitCode = 1;
}

main();
