import { z } from "zod";

/**
 * A URL field that accepts bare domains ("github.com/x") in addition to
 * fully-qualified URLs ("https://github.com/x") — `https://` is prepended
 * before validation if no scheme is present. `z.url()` alone rejects the
 * bare form, which is what most users actually type/paste into a "GitHub"
 * or "LinkedIn" field despite a "https://…" placeholder.
 */
export function looseUrl() {
  return z.preprocess((value) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    if (trimmed === "") return trimmed;
    return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  }, z.url());
}
