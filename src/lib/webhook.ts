import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";

/**
 * Guard for machine-to-machine endpoints (n8n → app).
 * n8n must send the shared secret in the `x-webhook-secret` header.
 *
 * In development with no secret configured we allow the call (local testing);
 * in production a missing secret is a hard failure — fail closed, not open.
 */
export function assertWebhookSecret(request: Request): void {
  const secret = env.N8N_CALLBACK_SECRET;

  if (!secret) {
    if (env.NODE_ENV === "production") {
      throw new AppError("INTERNAL", "N8N_CALLBACK_SECRET is not configured");
    }
    return; // dev convenience
  }

  const provided = request.headers.get("x-webhook-secret") ?? "";
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);

  // timing-safe comparison — never leak secret length/content via timing
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new AppError("UNAUTHORIZED", "Invalid webhook secret");
  }
}
