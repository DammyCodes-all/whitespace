/**
 * Route-facing Qloo quota state. One place maps the two "the lookup
 * never happened" errors to a response the client can branch on:
 * provider rate limit (429) and our own call-cap breach.
 *
 * Ordinary Qloo misses keep their existing contracts (not-found, empty
 * preview, no suggestions); only quota failures become 429.
 *
 * Spec ref: §8 (a miss never fails a batch), §11 (quota/rate limits).
 */

import { QlooQuotaError, QlooRateLimitError } from "./client.ts";

/** `ok` rides 200 responses; the other two ride 429 responses. */
export type QuotaState = "ok" | "rate-limited" | "exhausted";

export interface QuotaFailureResponse {
  status: 429;
  body: {
    error: string;
    quota: Exclude<QuotaState, "ok">;
    retryAfterMs?: number;
  };
  headers: Record<string, string>;
}

function failure(
  quota: QuotaFailureResponse["body"]["quota"],
  error: string,
  retryAfterMs: number | null,
): QuotaFailureResponse {
  const body: QuotaFailureResponse["body"] = { error, quota };
  const headers: Record<string, string> = {};
  if (retryAfterMs !== null) {
    body.retryAfterMs = retryAfterMs;
    headers["Retry-After"] = String(
      Math.max(0, Math.ceil(retryAfterMs / 1000)),
    );
  }
  return { status: 429, body, headers };
}

/** Null means the error is not a quota condition and keeps its route path. */
export function quotaFailure(err: unknown): QuotaFailureResponse | null {
  if (err instanceof QlooRateLimitError) {
    return failure(
      "rate-limited",
      "Qloo is rate-limiting requests right now. Try again in a moment.",
      err.retryAfterMs,
    );
  }
  if (err instanceof QlooQuotaError) {
    return failure(
      "exhausted",
      "This request used its Qloo call budget. Try again or use the sample.",
      null,
    );
  }
  return null;
}
