/**
 * Qloo network boundary. Owned by Q.
 *
 * Authenticated GET + retry + timeout + evidence trace, plus a Day 8
 * response cache and quota guard. Every Qloo call already passes
 * through `qlooFetch`, so the guard lives here rather than in a
 * wrapper nobody will remember to use.
 *
 * Cache contract: data only, never traces. Each call (hit or miss)
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
  /** Decoded JSON body, or null when the 200 response had no JSON body. */
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
}

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
    // Empty string means unconfigured, same as unset: mock mode stays on.
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status <= 599);
}

/**
 * Single authenticated GET against Qloo with retry, timeout, and a
 * §6.12 trace for the evidence drawer. Server-only: never import from
 * a Client Component and never expose the key to the browser.
 *
 * Offline contract (Council verdict): without a key it returns a
 * deterministic mock payload with fromCache=true instead of throwing,
 * so `pnpm build` and the Day 1 /run skeleton work with no secrets.
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
    params,
    at: new Date().toISOString(),
  };

  if (config.apiKey === null) {
    return {
      data: { success: true, mock: true, results: [] },
      trace: {
        ...traceBase,
        status: 0,
        durationMs: Date.now() - started,
        fromCache: true,
        responseSummary: summarizeResponse({
          success: true,
          mock: true,
          results: [],
        }),
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
        const data: unknown = await res.json().catch(() => null);
        const stored = structuredClone(data);
        responseCache.set(key, { data: stored, status: res.status });
        return {
          data: structuredClone(stored),
          trace: {
            ...traceBase,
            status: res.status,
            durationMs,
            fromCache: false,
            responseSummary: summarizeResponse(stored),
          },
        };
      }

      if (!isRetryableStatus(res.status) || attempt === config.maxRetries) {
        throw new QlooError(
          `Qloo ${path} failed with status ${res.status}.`,
          {
            ...traceBase,
            status: res.status,
            durationMs,
            fromCache: false,
          },
          isRetryableStatus(res.status),
        );
      }
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof QlooError) throw err;
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
