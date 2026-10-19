/**
 * Qloo network boundary. Owned by Q.
 *
 * Authenticated GET + retry + timeout + evidence trace, plus a Day 8
 * response cache and quota guard. Every Qloo call already passes
 * through `qlooFetch`, so the guard lives here rather than in a
 * wrapper nobody will remember to use.
 *
 * Cache contract: data plus the raw response text, never traces. Each call (hit or miss)
 * emits a fresh trace; hits carry `fromCache: true` so the evidence
 * drawer stays complete (§6.12). Stored payloads are cloned on the
 * way out: a caller mutating a response must never poison later runs.
 * `resetQuota` clears entries too, or run N inherits run 1's data.
 *
 * Real API shape per docs.qloo.com:
 * - base defaults to https://hackathon.api.qloo.com (override via env)
 * - auth header is `X-Api-Key` (not Bearer)
 * - GET /search?query=&types=&take= and GET /v2/insights?... are the
 *   Day 2+ workhorses; this stub is endpoint-agnostic on purpose.
 *
 * Spec ref: §8 (agent retries/replaces when Qloo cannot find a title),
 * §6.12 (every claim links to its Qloo call), §11 (quota/rate limits
 * mean the demo must survive offline via saved traces).
 */

import type { QlooCall } from "@/lib/types";

export interface QlooFetchOk {
  /** Decoded JSON body; only legacy calls accept a missing JSON body as null. */
  data: unknown;
  trace: QlooCall;
}

export class QlooError extends Error {
  readonly trace: QlooCall;
  readonly retryable: boolean;

  constructor(message: string, trace: QlooCall, retryable: boolean) {
    super(message);
    this.name = "QlooError";
    this.trace = trace;
    this.retryable = retryable;
  }
}

/**
 * Quota breach. Deliberately NOT a QlooError: callers translate
 * QlooError into not-found/no-data, and a quota blowout must never
 * degrade into fake missing data. It propagates.
 */
export class QlooQuotaError extends Error {
  readonly trace: QlooCall;
  readonly usage: QuotaUsage;

  constructor(message: string, trace: QlooCall, usage: QuotaUsage) {
    super(message);
    this.name = "QlooQuotaError";
    this.trace = trace;
    this.usage = usage;
  }
}

/**
 * Provider rate limit (HTTP 429) after every retry. Deliberately NOT a
 * QlooError: a rate-limited lookup never happened, so callers must not
 * turn it into not-found/no-data. It propagates to the route, which
 * reports a real quota state.
 */
export class QlooRateLimitError extends Error {
  readonly trace: QlooCall;
  /** Milliseconds from `Retry-After`, when the provider sent one. */
  readonly retryAfterMs: number | null;

  constructor(
    message: string,
    trace: QlooCall,
    retryAfterMs: number | null = null,
  ) {
    super(message);
    this.name = "QlooRateLimitError";
    this.trace = trace;
    this.retryAfterMs = retryAfterMs;
  }
}

/**
 * Generous ceiling, not a finding: above today's worst case (controls
 * alone warn 60+ calls), below absurdity. Counts network fetches only;
 * cache hits never trip it.
 */
export const MAX_CALLS_PER_RUN = 150;

export interface QuotaUsage {
  /** Network fetches performed. */
  calls: number;
  /** Invocations served from cache. */
  cached: number;
}

interface CacheEntry {
  data: unknown;
  status: number;
  /** Raw JSON text, already truncated at store time. Never reconstructed. */
  raw: string;
  truncated: boolean;
}

/**
 * Package A evidence bound (§6.12): the stored response keeps real bytes
 * up to this many chars, then a prefix with `responseTruncated` set.
 * Large enough for a take=50 insights page, small enough that a 100-call
 * saved run stays inside the ~5MB localStorage budget.
 */
export const MAX_EVIDENCE_RESPONSE_CHARS = 8_000;

/** Error bodies are diagnostic context only; keep them small. */
const MAX_ERROR_BODY_CHARS = 2_000;

const responseCache = new Map<string, CacheEntry>();
let networkCalls = 0;
let cacheHits = 0;

function summarizeResponse(data: unknown): string {
  if (data === null) return "null";
  if (Array.isArray(data)) return `array(${data.length})`;
  if (typeof data !== "object") return String(data);
  try {
    const json = JSON.stringify(data);
    return json.length > 500 ? `${json.slice(0, 500)}…` : json;
  } catch {
    return "unserializable response";
  }
}

function cacheKey(path: string, params: Record<string, string>): string {
  const query = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return `${path}?${query}`;
}

/**
 * Strip the API key from anything stored. The key travels in the
 * `X-Api-Key` header (never in params), but a value echoing it must
 * never reach a trace, a saved run, or the browser.
 */
function redactKey(value: string, apiKey: string | null): string {
  if (apiKey === null || apiKey === "") return value;
  return value.split(apiKey).join("[REDACTED]");
}

function redactParams(
  params: Record<string, string>,
  apiKey: string | null,
): Record<string, string> {
  if (apiKey === null || apiKey === "") return { ...params };
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    out[redactKey(k, apiKey)] = redactKey(v, apiKey);
  }
  return out;
}

/** Truncate real bytes; the flag, not a rebuild, marks the cut. */
function toStoredBody(raw: string): {
  responseBody: string;
  responseTruncated?: boolean;
} {
  if (raw.length > MAX_EVIDENCE_RESPONSE_CHARS) {
    return {
      responseBody: raw.slice(0, MAX_EVIDENCE_RESPONSE_CHARS),
      responseTruncated: true,
    };
  }
  return { responseBody: raw };
}

/** Quota accounting snapshot. */
export function getQuotaUsage(): QuotaUsage {
  return { calls: networkCalls, cached: cacheHits };
}

/**
 * Zero the counters and drop cached payloads. The pipeline calls this
 * at run start: entries are keyed by request, not by run, so without
 * the clear, run N would silently reuse run 1's data.
 */
export function resetQuota(): void {
  networkCalls = 0;
  cacheHits = 0;
  responseCache.clear();
}

function readEnv(name: string, fallback: string): string {
  const value = process.env[name];
  return value === undefined || value === "" ? fallback : value;
}

export interface QlooConfig {
  baseUrl: string;
  apiKey: string | null;
  timeoutMs: number;
  maxRetries: number;
}

export function getQlooConfig(): QlooConfig {
  const timeoutRaw = readEnv("QLOO_TIMEOUT_MS", "10000");
  const retriesRaw = readEnv("QLOO_MAX_RETRIES", "2");
  const timeoutParsed = Number.parseInt(timeoutRaw, 10);
  const retriesParsed = Number.parseInt(retriesRaw, 10);
  const rawKey = process.env.QLOO_API_KEY;

  return {
    baseUrl: readEnv("QLOO_BASE_URL", "https://hackathon.api.qloo.com").replace(
      /\/$/,
      "",
    ),
    // Empty string means unconfigured, same as unset: no request runs.
    apiKey: rawKey === undefined || rawKey === "" ? null : rawKey,
    timeoutMs:
      Number.isFinite(timeoutParsed) && timeoutParsed > 0
        ? timeoutParsed
        : 10000,
    maxRetries: Number.isFinite(retriesParsed)
      ? Math.min(5, Math.max(0, retriesParsed))
      : 2,
  };
}

export function isQlooConfigured(): boolean {
  return getQlooConfig().apiKey !== null;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const cancel = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", cancel);
      reject(new DOMException("Qloo request cancelled.", "AbortError"));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", cancel);
      resolve();
    }, ms);
    signal?.addEventListener("abort", cancel, { once: true });
    if (signal?.aborted) cancel();
  });
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status <= 599);
}

/** Parse `Retry-After` as delta-seconds or an HTTP date. */
function retryAfterMs(response: Response): number | null {
  const raw = response.headers.get("retry-after");
  if (raw === null || raw.trim() === "") return null;
  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0)
    return Math.round(seconds * 1000);
  const at = Date.parse(raw);
  return Number.isFinite(at) ? Math.max(0, at - Date.now()) : null;
}

/**
 * Single authenticated GET against Qloo with retry, timeout, and a
 * §6.12 trace for the evidence drawer. Server-only: never import from
 * a Client Component and never expose the key to the browser.
 *
 * Keyless contract: without a key, no request runs. The call returns a
 * placeholder payload marked `mock: true` (never data, never
 * `fromCache`), so every caller degrades to no-data and the evidence
 * drawer says why instead of showing a fake cached success.
 */
export async function qlooFetch(
  path: string,
  params: Record<string, string> = {},
): Promise<QlooFetchOk> {
  if (typeof window !== "undefined") {
    throw new Error("qlooFetch is server-only and cannot run in the browser.");
  }

  const config = getQlooConfig();
  const started = Date.now();
  const traceBase = {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `qloo-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`,
    endpoint: path,
    method: "GET" as const,
    params: redactParams(params, config.apiKey),
    at: new Date().toISOString(),
  };

  if (config.apiKey === null) {
    const mockBody = {
      success: false,
      mock: true,
      results: [],
      error: "QLOO_API_KEY is not set; no request was made.",
    };
    return {
      data: mockBody,
      trace: {
        ...traceBase,
        status: 0,
        durationMs: Date.now() - started,
        fromCache: false,
        mock: true,
        responseSummary: summarizeResponse(mockBody),
        ...toStoredBody(JSON.stringify(mockBody)),
      },
    };
  }

  const key = cacheKey(path, params);
  const hit = responseCache.get(key);
  if (hit !== undefined) {
    cacheHits += 1;
    return {
      data: structuredClone(hit.data),
      trace: {
        ...traceBase,
        status: hit.status,
        durationMs: Date.now() - started,
        fromCache: true,
        responseSummary: summarizeResponse(hit.data),
        responseBody: hit.raw,
        ...(hit.truncated ? { responseTruncated: true as const } : {}),
      },
    };
  }

  if (networkCalls >= MAX_CALLS_PER_RUN) {
    throw new QlooQuotaError(
      `Qloo quota exceeded: ${networkCalls} network calls (cap ${MAX_CALLS_PER_RUN}).`,
      {
        ...traceBase,
        status: 0,
        durationMs: Date.now() - started,
        fromCache: false,
      },
      getQuotaUsage(),
    );
  }
  networkCalls += 1;

  const query = new URLSearchParams(params).toString();
  const url = `${config.baseUrl}${path}${query ? `?${query}` : ""}`;

  let lastStatus = 0;

  for (let attempt = 0; attempt <= config.maxRetries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.timeoutMs);
    try {
      const res = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": config.apiKey,
        },
        signal: controller.signal,
      });
      clearTimeout(timer);
      lastStatus = res.status;
      const durationMs = Date.now() - started;

      if (res.ok) {
        const rawText = await res.text().catch(() => "");
        let data: unknown = null;
        try {
          data = rawText === "" ? null : JSON.parse(rawText);
        } catch {
          data = null;
        }
        const stored = structuredClone(data);
        const body = toStoredBody(rawText);
        responseCache.set(key, {
          data: stored,
          status: res.status,
          raw: body.responseBody,
          truncated: body.responseTruncated === true,
        });
        return {
          data: structuredClone(stored),
          trace: {
            ...traceBase,
            status: res.status,
            durationMs,
            fromCache: false,
            responseSummary: summarizeResponse(stored),
            ...body,
          },
        };
      }

      if (!isRetryableStatus(res.status) || attempt === config.maxRetries) {
        const errText = await res.text().catch(() => "");
        const errBody =
          errText.length > MAX_ERROR_BODY_CHARS
            ? {
                responseBody: errText.slice(0, MAX_ERROR_BODY_CHARS),
                responseTruncated: true as const,
              }
            : errText === ""
              ? {}
              : { responseBody: errText };
        const trace: QlooCall = {
          ...traceBase,
          status: res.status,
          durationMs,
          fromCache: false,
          ...errBody,
        };
        if (res.status === 429) {
          throw new QlooRateLimitError(
            `Qloo ${path} is rate-limited (429).`,
            trace,
            retryAfterMs(res),
          );
        }
        throw new QlooError(
          `Qloo ${path} failed with status ${res.status}.`,
          trace,
          isRetryableStatus(res.status),
        );
      }
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof QlooError || err instanceof QlooRateLimitError) {
        throw err;
      }
      const aborted =
        err instanceof Error &&
        (err.name === "AbortError" || err.message.includes("abort"));
      const durationMs = Date.now() - started;
      // Timeouts retry only on the first attempt; other network errors
      // retry until the budget is spent. Otherwise fall through to the
      // backoff sleep below.
      const canRetry =
        attempt < config.maxRetries && (!aborted || attempt === 0);
      if (!canRetry) {
        throw new QlooError(
          aborted
            ? `Qloo ${path} timed out after ${config.timeoutMs}ms.`
            : `Qloo ${path} request failed.`,
          { ...traceBase, status: lastStatus, durationMs, fromCache: false },
          true,
        );
      }
    }
    await sleep(300 * 2 ** attempt + Math.floor(Math.random() * 100));
  }

  throw new QlooError(
    `Qloo ${path} retries exhausted.`,
    {
      ...traceBase,
      status: lastStatus,
      durationMs: Date.now() - started,
      fromCache: false,
    },
    true,
  );
}
