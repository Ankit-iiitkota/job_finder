/**
 * Smoke test: hit each free job API for real and print what comes back.
 * Usage: npx tsx scripts/smoke-adapters.ts
 * (No DB needed — this tests fetch + normalization only.)
 */
import { jobSourceAdapters } from "@/server/jobs/adapters";
import { computeMatchScore } from "@/server/jobs/match";

const QUERIES = ["react", "typescript"];

async function main() {
  for (const adapter of jobSourceAdapters) {
    const started = Date.now();
    try {
      const jobs = await adapter.fetch(QUERIES);
      const sample = jobs[0];
      console.log(
        `\n✅ ${adapter.source}: ${jobs.length} jobs in ${Date.now() - started}ms`,
      );
      if (sample) {
        const match = computeMatchScore(QUERIES, sample);
        console.log(`   sample: "${sample.title}" @ ${sample.company}`);
        console.log(`   posted: ${sample.postedAt?.toISOString() ?? "unknown"}`);
        console.log(`   tags:   ${sample.tags.slice(0, 6).join(", ")}`);
        console.log(`   match:  ${match.score}/100 (matched: ${match.matched.join(", ") || "-"})`);
        console.log(`   desc:   ${sample.description.slice(0, 120).replace(/\n/g, " ")}...`);
      }
    } catch (error) {
      console.error(`\n❌ ${adapter.source} failed:`, error);
      process.exitCode = 1;
    }
  }
}

main();
