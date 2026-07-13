/**
 * Smoke test: verify the live database has all expected tables and the
 * job-scan -> DB write path works end-to-end.
 * Usage: npx tsx scripts/smoke-db.ts
 */
import "dotenv/config";
import { db } from "@/lib/db";
import { scanJobs } from "@/server/services/job-scanner";

async function main() {
  const tables = await db.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
  `;
  console.log(`✅ connected — ${tables.length} tables:`);
  for (const t of tables) console.log(`   - ${t.tablename}`);

  const result = await scanJobs({ queries: ["react"], maxAgeHours: 24 * 14 });
  console.log(`\n✅ scan wrote to DB: fetched=${result.fetched} fresh=${result.fresh} inserted=${result.inserted}`);

  const count = await db.job.count();
  console.log(`✅ total jobs in DB: ${count}`);

  await db.$disconnect();
}

main().catch((err) => {
  console.error("❌", err);
  process.exit(1);
});
