/**
 * Client-side helper: turn a failed API response into a readable message.
 *
 * Every API error follows the `apiHandler`/`toErrorResponse` envelope
 * (lib/errors.ts): `{ error: { code, message, details? } }`. Validation
 * failures carry per-field `details` — without reading them, the UI can
 * only ever show the generic "Validation failed", leaving the user with no
 * way to tell which field was wrong or why.
 */
interface ApiErrorBody {
  error?: {
    message?: string;
    details?: { path?: string; message?: string }[];
  };
}

export async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as ApiErrorBody;
    const base = body.error?.message ?? `Request failed (${response.status})`;
    const details = body.error?.details;
    if (!Array.isArray(details) || details.length === 0) return base;

    const fields = details
      .map((d) => (d.path ? `${d.path}: ${d.message}` : d.message))
      .filter(Boolean)
      .join("; ");
    return fields ? `${base} — ${fields}` : base;
  } catch {
    return `Request failed (${response.status})`;
  }
}
