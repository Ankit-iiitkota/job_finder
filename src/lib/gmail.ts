import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { safeFetch } from "@/lib/http";
import { decryptIfNeeded, encryptSecret } from "@/lib/crypto";

/**
 * Gmail via raw REST (FEATURES.md F5) — deliberately NOT the `googleapis`
 * package: we need exactly two endpoints (token refresh + send), and the
 * official SDK is a ~10MB dependency. Emails go out from the USER'S OWN
 * inbox — authenticity + deliverability, and the user keeps full control.
 */

interface TokenRefreshResponse {
  access_token: string;
  expires_in: number; // seconds
}

/** Get a live access token for the user, refreshing (and persisting) if expired. */
export async function getGmailAccessToken(userId: string): Promise<string> {
  const account = await db.account.findFirst({
    where: { userId, provider: "google" },
    select: { id: true, access_token: true, refresh_token: true, expires_at: true },
  });
  if (!account?.refresh_token) {
    throw new AppError(
      "BAD_REQUEST",
      "Gmail is not connected — sign out and sign in with Google again",
    );
  }

  const now = Math.floor(Date.now() / 1000);
  const stillValid = account.access_token && (account.expires_at ?? 0) > now + 60;
  if (stillValid) return decryptIfNeeded(account.access_token)!;

  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    throw new AppError("INTERNAL", "Google OAuth is not configured");
  }

  const response = await safeFetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token: decryptIfNeeded(account.refresh_token)!,
      grant_type: "refresh_token",
    }),
    retries: 1,
  });

  if (!response.ok) {
    logger.error({ userId, status: response.status }, "gmail token refresh failed");
    throw new AppError(
      "UPSTREAM_ERROR",
      "Gmail authorization expired — sign out and sign in with Google again",
    );
  }

  const token = (await response.json()) as TokenRefreshResponse;
  await db.account.update({
    where: { id: account.id },
    data: {
      access_token: encryptSecret(token.access_token), // encrypted at rest — never plaintext in the DB
      expires_at: now + token.expires_in,
    },
  });
  return token.access_token;
}

// ---------------------------------------------------------------------------
// MIME building (RFC 2822 + multipart for the PDF attachment)
// ---------------------------------------------------------------------------

function base64Url(data: Buffer): string {
  return data.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** RFC 2047 encoded-word so non-ASCII subjects survive transport. */
function encodeSubject(subject: string): string {
  return /^[\x20-\x7e]*$/.test(subject)
    ? subject
    : `=?UTF-8?B?${Buffer.from(subject, "utf8").toString("base64")}?=`;
}

/** base64 with 76-char lines per MIME spec. */
function base64Lines(data: Buffer): string {
  return data.toString("base64").replace(/(.{76})/g, "$1\r\n");
}

export interface OutgoingEmail {
  to: string;
  subject: string;
  body: string; // plain text
  attachment?: { filename: string; content: Buffer; mimeType: string };
  /** set to reply within an existing Gmail thread (follow-ups) */
  threadId?: string;
  inReplyTo?: string; // Message-ID header of the original for proper threading
}

function buildMime(email: OutgoingEmail): string {
  const boundary = `b_${Date.now().toString(36)}`;
  const headers = [
    `To: ${email.to}`,
    `Subject: ${encodeSubject(email.subject)}`,
    ...(email.inReplyTo
      ? [`In-Reply-To: ${email.inReplyTo}`, `References: ${email.inReplyTo}`]
      : []),
    "MIME-Version: 1.0",
  ];

  if (!email.attachment) {
    return [
      ...headers,
      'Content-Type: text/plain; charset="UTF-8"',
      "Content-Transfer-Encoding: base64",
      "",
      base64Lines(Buffer.from(email.body, "utf8")),
    ].join("\r\n");
  }

  return [
    ...headers,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    base64Lines(Buffer.from(email.body, "utf8")),
    `--${boundary}`,
    `Content-Type: ${email.attachment.mimeType}; name="${email.attachment.filename}"`,
    `Content-Disposition: attachment; filename="${email.attachment.filename}"`,
    "Content-Transfer-Encoding: base64",
    "",
    base64Lines(email.attachment.content),
    `--${boundary}--`,
  ].join("\r\n");
}

export interface SentEmail {
  gmailMessageId: string;
  gmailThreadId: string;
}

/** Send an email from the user's own Gmail. */
export async function sendGmail(userId: string, email: OutgoingEmail): Promise<SentEmail> {
  const accessToken = await getGmailAccessToken(userId);

  const response = await safeFetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        raw: base64Url(Buffer.from(buildMime(email), "utf8")),
        ...(email.threadId ? { threadId: email.threadId } : {}),
      }),
      timeoutMs: 30_000,
      retries: 0, // NEVER auto-retry sends — a retry after an ambiguous failure double-sends
    },
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    logger.error({ userId, status: response.status, detail: detail.slice(0, 300) }, "gmail send failed");
    throw new AppError("UPSTREAM_ERROR", "Sending the email failed — please retry");
  }

  const sent = (await response.json()) as { id: string; threadId: string };
  return { gmailMessageId: sent.id, gmailThreadId: sent.threadId };
}
