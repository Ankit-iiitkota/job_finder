import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";

/**
 * AES-256-GCM field-level encryption for secrets we must persist — Gmail
 * OAuth tokens (FEATURES.md §9 security review). GCM's auth tag means a
 * tampered ciphertext fails to decrypt rather than silently returning
 * garbage bytes.
 *
 * Key derivation: SHA-256 of AUTH_SECRET. AUTH_SECRET is already
 * high-entropy random data (generated via `npx auth secret`), so hashing it
 * down to 32 bytes is a safe, dependency-free way to get an AES-256 key
 * without introducing a second secret to manage and rotate.
 */
const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12; // GCM's recommended nonce size
const PREFIX = "v1:"; // format version, so key/scheme rotation stays detectable

function getKey(): Buffer {
  if (!env.AUTH_SECRET) {
    throw new AppError("INTERNAL", "AUTH_SECRET must be set to store encrypted secrets");
  }
  return createHash("sha256").update(env.AUTH_SECRET).digest();
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64")}:${tag.toString("base64")}:${ciphertext.toString("base64")}`;
}

export function decryptSecret(payload: string): string {
  if (!payload.startsWith(PREFIX)) {
    throw new AppError("INTERNAL", "Cannot decrypt: not a v1 encrypted payload");
  }
  const [ivB64, tagB64, dataB64] = payload.slice(PREFIX.length).split(":");
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new AppError("INTERNAL", "Cannot decrypt: malformed payload");
  }

  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(), // throws if the auth tag doesn't match — tamper/corruption detection
  ]);
  return plaintext.toString("utf8");
}

/** Distinguishes our ciphertext format from legacy plaintext during rollout. */
export function isEncrypted(value: string | null | undefined): value is string {
  return typeof value === "string" && value.startsWith(PREFIX);
}

/** Decrypt if encrypted, pass through unchanged otherwise (safe migration path). */
export function decryptIfNeeded(value: string | null): string | null {
  if (!value) return value;
  return isEncrypted(value) ? decryptSecret(value) : value;
}
