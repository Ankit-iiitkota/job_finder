import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { env } from "@/lib/env"; // also applies the process-wide IPv4 DNS preference — see env.ts
import { logger } from "@/lib/logger";

/**
 * Transient-connection retry, same philosophy as `safeFetch` (lib/http.ts)
 * but at the Prisma query layer. Observed empirically against Neon's free
 * tier: an intermittent connection failure (compute waking from
 * autosuspend, a dropped pooler connection) surfaces as ETIMEDOUT / P1001 /
 * P1017 on a single query — retrying the SAME query a moment later
 * succeeds without any special handling, because the underlying pool
 * recovers on its own. Non-transient errors (constraint violations, bad
 * queries) are never retried — retrying those would just be slower failure.
 */
const RETRYABLE_CODES = new Set(["P1001", "P1002", "P1008", "P1017"]);
const RETRYABLE_ERROR_CODES = new Set(["ETIMEDOUT", "ECONNRESET", "ECONNREFUSED"]);
const MAX_QUERY_RETRIES = 4; // ~4.5s worst-case budget (300/600/1200/2400ms) — this network's observed flakiness needs more than 2 attempts

function isTransientDbError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const code = "code" in error ? String((error as { code?: unknown }).code) : undefined;
  if (code && (RETRYABLE_CODES.has(code) || RETRYABLE_ERROR_CODES.has(code))) return true;
  // node-postgres sometimes nests the real error one level down
  const cause = "cause" in error ? (error as { cause?: unknown }).cause : undefined;
  return isTransientDbError(cause);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Prisma client singleton (Prisma 7: TS client + pg driver adapter).
 *
 * Next.js hot-reload re-imports modules in dev; without the globalThis guard
 * every reload would open a new connection pool and exhaust Postgres.
 */
const globalForPrisma = globalThis as unknown as { prisma?: ReturnType<typeof createClient> };

function createClient() {
  const adapter = new PrismaPg({
    connectionString: env.DATABASE_URL,
    connectionTimeoutMillis: 10_000,
  });

  return new PrismaClient({ adapter }).$extends({
    query: {
      async $allOperations({ operation, model, args, query }) {
        for (let attempt = 0; ; attempt++) {
          try {
            return await query(args);
          } catch (error) {
            if (attempt >= MAX_QUERY_RETRIES || !isTransientDbError(error)) throw error;
            const backoff = 300 * 2 ** attempt;
            logger.warn(
              { model, operation, attempt: attempt + 1, backoffMs: backoff },
              "transient DB error, retrying",
            );
            await sleep(backoff);
          }
        }
      },
    },
  });
}

export const db = globalForPrisma.prisma ?? createClient();

if (env.NODE_ENV !== "production") globalForPrisma.prisma = db;
