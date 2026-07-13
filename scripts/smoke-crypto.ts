/**
 * Smoke test: AES-256-GCM round trip + tamper detection.
 * Usage: npx tsx scripts/smoke-crypto.ts
 */
import "dotenv/config";
import { decryptSecret, encryptSecret, isEncrypted } from "@/lib/crypto";

function assert(condition: boolean, label: string): void {
  console.log(`${condition ? "✅" : "❌"} ${label}`);
  if (!condition) process.exitCode = 1;
}

function main() {
  const secret = "ya29.a0AfH6SMC_fake_refresh_token_value";
  const encrypted = encryptSecret(secret);

  assert(encrypted !== secret, "ciphertext differs from plaintext");
  assert(isEncrypted(encrypted), "isEncrypted() recognizes our format");
  assert(!isEncrypted(secret), "isEncrypted() rejects plaintext");
  assert(decryptSecret(encrypted) === secret, "round trip recovers the exact plaintext");

  // tamper with one byte of the ciphertext — GCM must reject it, not return garbage
  const tampered = encrypted.slice(0, -4) + "abcd";
  let tamperDetected = false;
  try {
    decryptSecret(tampered);
  } catch {
    tamperDetected = true;
  }
  assert(tamperDetected, "tampered ciphertext throws instead of decrypting silently");

  // two encryptions of the same plaintext must differ (random IV) but both decrypt correctly
  const encrypted2 = encryptSecret(secret);
  assert(encrypted2 !== encrypted, "same plaintext encrypts to different ciphertext each time (random IV)");
  assert(decryptSecret(encrypted2) === secret, "second ciphertext also round-trips correctly");
}

main();
