import pino from "pino";

/**
 * Structured logger (AGENTS.md 4.6 rule 6).
 *
 * - Production: JSON lines → easy to ship to any log aggregator.
 * - Development: pretty-printed for humans.
 *
 * Usage: `logger.info({ jobId }, "job scanned")` — context object first,
 * message second. Never use console.log in server code.
 */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  ...(process.env.NODE_ENV === "development"
    ? {
        transport: {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "HH:MM:ss" },
        },
      }
    : {}),
});

/** Child logger carrying a request/workflow correlation id. */
export function withRequestId(requestId: string) {
  return logger.child({ requestId });
}
