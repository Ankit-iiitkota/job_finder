import { logger } from "@/lib/logger";
import { AppError } from "@/lib/errors";

/**
 * Resilient fetch wrapper for ALL external calls — job APIs, company-website
 * scraping, etc. (AGENTS.md 4.6 rule 7)
 *
 * Adds on top of plain fetch:
 *  - hard timeout via AbortController (default 15s)
 *  - retries with exponential backoff + jitter on 429/5xx/network errors
 *  - per-host politeness delay so we never hammer one domain
 */

interface FetchOptions extends RequestInit {
  /** milliseconds before the request is aborted (default 15_000) */
  timeoutMs?: number;
  /** retry attempts after the first try (default 2) */
  retries?: number;
  /** minimum gap between two requests to the same host (default 1_000ms) */
  perHostDelayMs?: number;
}

const lastRequestAt = new Map<string, number>();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function respectHostDelay(url: string, delayMs: number): Promise<void> {
  const host = new URL(url).host;
  const last = lastRequestAt.get(host) ?? 0;
  const waitFor = last + delayMs - Date.now();
  if (waitFor > 0) await sleep(waitFor);
  lastRequestAt.set(host, Date.now());
}

function isRetryable(status: number): boolean {
  return status === 429 || status >= 500;
}

export async function safeFetch(
  url: string,
  options: FetchOptions = {},
): Promise<Response> {
  const {
    timeoutMs = 15_000,
    retries = 2,
    perHostDelayMs = 1_000,
    ...init
  } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    await respectHostDelay(url, perHostDelayMs);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, { ...init, signal: controller.signal });

      if (response.ok || !isRetryable(response.status)) {
        return response; // success, or a non-retryable error (404 etc.) the caller handles
      }

      lastError = new AppError(
        "UPSTREAM_ERROR",
        `Upstream ${response.status} from ${new URL(url).host}`,
      );
    } catch (error) {
      lastError = error; // network failure or timeout
    } finally {
      clearTimeout(timer);
    }

    if (attempt < retries) {
      // exponential backoff with jitter: ~1s, ~2s, ~4s...
      const backoff = 2 ** attempt * 1_000 + Math.random() * 500;
      logger.warn(
        { url, attempt: attempt + 1, backoffMs: Math.round(backoff) },
        "retrying upstream request",
      );
      await sleep(backoff);
    }
  }

  throw lastError instanceof AppError
    ? lastError
    : new AppError("UPSTREAM_ERROR", `Request to ${url} failed`, {
        cause: String(lastError),
      });
}

/** Convenience: fetch + parse JSON, throwing AppError on non-OK responses. */
export async function fetchJson<T>(
  url: string,
  options: FetchOptions = {},
): Promise<T> {
  const response = await safeFetch(url, options);
  if (!response.ok) {
    throw new AppError(
      "UPSTREAM_ERROR",
      `Upstream ${response.status} from ${new URL(url).host}`,
    );
  }
  return (await response.json()) as T;
}
