import { resolveMx } from "node:dns/promises";

/**
 * Step 3 of the free email pipeline: DNS-level verification.
 * MX lookup answers "does this domain receive mail at all?" — free, fast,
 * and eliminates guaranteed bounces.
 *
 * Documented limitation: true mailbox verification needs an SMTP RCPT-TO
 * handshake on port 25, which cloud hosts block. Pattern confidence + MX
 * is the honest zero-cost ceiling — bounce handling covers the rest.
 */
export async function domainAcceptsMail(domain: string): Promise<boolean> {
  try {
    const records = await resolveMx(domain);
    return records.length > 0;
  } catch {
    return false;
  }
}

/** Try to find the mail-receiving domain for a company (bare vs www, etc.). */
export function cleanDomain(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0];
}
