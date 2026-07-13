import type { Adapter, AdapterAccount } from "next-auth/adapters";
import { encryptSecret } from "@/lib/crypto";

/**
 * Wraps an Auth.js adapter so OAuth tokens are encrypted before they ever
 * reach the database (FEATURES.md §9 security review). Only `linkAccount`
 * needs wrapping — it's the sole adapter method that writes access_token /
 * refresh_token; nothing else on the Adapter interface touches them.
 *
 * The other read side of this boundary is `getGmailAccessToken` in
 * `lib/gmail.ts`, which decrypts on read.
 */
export function withEncryptedTokens(adapter: Adapter): Adapter {
  const baseLinkAccount = adapter.linkAccount?.bind(adapter);
  if (!baseLinkAccount) return adapter;

  return {
    ...adapter,
    async linkAccount(account: AdapterAccount): Promise<AdapterAccount | null | undefined> {
      const secured: AdapterAccount = {
        ...account,
        access_token: account.access_token ? encryptSecret(account.access_token) : account.access_token,
        refresh_token: account.refresh_token
          ? encryptSecret(account.refresh_token)
          : account.refresh_token,
      };
      const result = await baseLinkAccount(secured);
      return result ?? undefined;
    },
  };
}
