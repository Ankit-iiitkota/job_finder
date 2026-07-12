import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { logger } from "@/lib/logger";

/**
 * Central error handling (AGENTS.md 4.6 rule 5).
 *
 * Every API route returns the same envelope on failure:
 *   { "error": { "code": "NOT_FOUND", "message": "..." } }
 * Stack traces never leak to clients.
 */

export type ErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "UPSTREAM_ERROR" // an external API (job source, Gmail, LLM) failed
  | "INTERNAL";

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  UPSTREAM_ERROR: 502,
  INTERNAL: 500,
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  /** extra machine-readable context, safe to return to the client */
  readonly details?: unknown;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.details = details;
  }
}

/** Convert any thrown value into a safe JSON API response. */
export function toErrorResponse(error: unknown): NextResponse {
  if (error instanceof AppError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message, details: error.details } },
      { status: error.status },
    );
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: "BAD_REQUEST",
          message: "Validation failed",
          details: error.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
          })),
        },
      },
      { status: 400 },
    );
  }

  // Unknown error: log the real cause, return a generic message.
  logger.error({ err: error }, "unhandled error");
  return NextResponse.json(
    { error: { code: "INTERNAL", message: "Something went wrong" } },
    { status: 500 },
  );
}

/**
 * Wrap a route handler so thrown errors become consistent JSON responses.
 *
 *   export const POST = apiHandler(async (req) => { ... });
 */
export function apiHandler<Args extends unknown[]>(
  handler: (...args: Args) => Promise<NextResponse>,
) {
  return async (...args: Args): Promise<NextResponse> => {
    try {
      return await handler(...args);
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}
