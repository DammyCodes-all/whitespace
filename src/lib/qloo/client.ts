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
import type { V2EvidenceCall } from "../pipeline/v2/types.ts";

/** V2 transport ownership: one context per run, including every retry. */
export interface QlooRequestContext {
  used: number;
  ceiling: number;
  signal?: AbortSignal;
  calls?: V2EvidenceCall[];
}

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

// Context identity, not process quota/reset state, owns v2 cached responses.
const requestCaches = new WeakMap<
  QlooRequestContext,
  Map<string, CacheEntry>
>();
const MAX_EVIDENCE_RESPONSE_CHARS = 64_000;

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

function sensitiveField(name: string): boolean {
  return /^(?:x[-_]?api[-_]?key|api[-_]?key|authorization|access[-_]?token|token|secret)$/i.test(
    name,
  );
}

function redactText(value: string, apiKey: string | null): string {
  return apiKey === null ? value : value.split(apiKey).join("[REDACTED]");
}

function captureResponse(
  response: unknown,
  apiKey: string | null,
): { response: unknown; responseTruncated?: boolean } {
  const json = JSON.stringify(response, (name, value: unknown) => {
    if (sensitiveField(name)) return "[REDACTED]";
    return typeof value === "string" ? redactText(value, apiKey) : value;
  });
  if (json.length > MAX_EVIDENCE_RESPONSE_CHARS) {
    return {
      response: { preview: json.slice(0, MAX_EVIDENCE_RESPONSE_CHARS) },
      responseTruncated: true,
    };
  }
  return { response: JSON.parse(json) as unknown };
}

/** A missing/malformed result envelope is not a completed empty lookup. */
function validV2Response(path: string, data: unknown): boolean {
  if (typeof data !== "object" || data === null || Array.isArray(data))
    return false;
  const results = (data as Record<string, unknown>).results;
  if (path === "/search") return Array.isArray(results);
  if (path === "/v2/insights") {
    return (
      Array.isArray(results) ||
      (typeof results === "object" &&
        results !== null &&
        Array.isArray((results as Record<string, unknown>).entities))
    );
  }
  return true;
}

/** Separate v2 ownership preserves the legacy no-context quota/mock contract. */
async function qlooFetchWithContext(
  path: string,
  params: Record<string, string>,
  context: QlooRequestContext,
): Promise<QlooFetchOk> {
  const config = getQlooConfig();
  const started = Date.now();
  const requestParams = { ...params };
  const traceBase = {
    id: crypto.randomUUID(),
    endpoint: redactText(path, config.apiKey),
    method: "GET" as const,
    params: Object.fromEntries(
      Object.entries(requestParams).map(([name, value]) => [
        name,
        sensitiveField(name) ? "[REDACTED]" : redactText(value, config.apiKey),
      ]),
    ),
    at: new Date().toISOString(),
  };
  let attempts = 0;
  let status = 0;
  let response: unknown = null;
  const traceOf = (fromCache = false): QlooCall => ({
    ...traceBase,
    status,
    durationMs: Date.now() - started,
    fromCache,
    responseSummary: summarizeResponse(
      captureResponse(response, config.apiKey).response,
    ),
  });
  const record = (trace: QlooCall, error?: string) => {
    context.calls?.push({
      ...trace,
      params: { ...trace.params },
      ...captureResponse(response, config.apiKey),
      attempts,
      ...(error === undefined
        ? {}
        : { error: redactText(error, config.apiKey) }),
    });
  };
  const checkCancelled = () => {
    if (context.signal?.aborted) {
      throw new QlooError(
        `Qloo ${traceBase.endpoint} request cancelled.`,
        traceOf(),
        false,
      );
    }
  };
  const checkBudget = () => {
    if (context.used >= context.ceiling) {
      throw new QlooQuotaError(
        `Qloo budget exhausted (${context.used}/${context.ceiling}); no further HTTP attempt sent.`,
        traceOf(),
        { calls: context.used, cached: 0 },
      );
    }
  };

  try {
    checkCancelled();
    let cache = requestCaches.get(context);
    if (cache === undefined) {
      cache = new Map();
      requestCaches.set(context, cache);
    }
    // JSON encoding avoids delimiter collisions; origin/auth changes cannot hit an old entry.
    const key = JSON.stringify([
      config.baseUrl,
      config.apiKey,
      path,
      Object.entries(requestParams).sort(([a], [b]) => a.localeCompare(b)),
    ]);
    const hit = config.apiKey === null ? undefined : cache.get(key);
    if (hit !== undefined) {
      status = hit.status;
      response = hit.data;
      const trace = traceOf(true);
      record(trace);
      return { data: structuredClone(hit.data), trace };
    }
    checkBudget();
    if (config.apiKey === null) {
      throw new QlooError("Qloo API key is not configured.", traceOf(), false);
    }
    const query = new URLSearchParams(requestParams).toString();
    const url = `${config.baseUrl}${path}${query ? `?${query}` : ""}`;

    for (let attempt = 0; attempt <= config.maxRetries; attempt += 1) {
      checkCancelled();
      checkBudget();
      const controller = new AbortController();
      const cancel = () => controller.abort();
      context.signal?.addEventListener("abort", cancel, { once: true });
      const timer = setTimeout(() => controller.abort(), config.timeoutMs);
      try {
        status = 0;
        response = null;
        // Reserve synchronously at the fetch boundary, including failures and retries.
        context.used += 1;
        attempts += 1;
        const res = await fetch(url, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "X-Api-Key": config.apiKey,
          },
          signal: controller.signal,
        });
        checkCancelled();
        status = res.status;
        const text = await res.text();
        checkCancelled();
        let validJson = true;
        try {
          response = JSON.parse(text) as unknown;
        } catch {
          validJson = false;
          response = text;
        }
        if (res.ok) {
          if (!validJson) {
            throw new QlooError(
              `Qloo ${traceBase.endpoint} returned malformed JSON.`,
              traceOf(),
              false,
            );
          }
          if (
            typeof response === "object" &&
            response !== null &&
            (response as Record<string, unknown>).success === false
          ) {
            throw new QlooError(
              `Qloo ${traceBase.endpoint} reported a provider failure.`,
              traceOf(),
              false,
            );
          }
          if (!validV2Response(path, response)) {
            throw new QlooError(
              `Qloo ${traceBase.endpoint} returned a malformed results envelope.`,
              traceOf(),
              false,
            );
          }
          const stored = structuredClone(response);
          cache.set(key, { data: stored, status });
          const trace = traceOf();
          record(trace);
          return { data: structuredClone(stored), trace };
        }
        if (!isRetryableStatus(status) || attempt === config.maxRetries) {
          throw new QlooError(
            `Qloo ${traceBase.endpoint} failed with status ${status}.`,
            traceOf(),
            isRetryableStatus(status),
          );
        }
      } catch (err) {
        checkCancelled();
        if (err instanceof QlooError) throw err;
        const aborted =
          controller.signal.aborted ||
          (err instanceof Error && err.name === "AbortError");
        if (attempt === config.maxRetries || (aborted && attempt > 0)) {
          throw new QlooError(
            aborted
              ? `Qloo ${traceBase.endpoint} timed out after ${config.timeoutMs}ms.`
              : `Qloo ${traceBase.endpoint} request failed.`,
            traceOf(),
            true,
          );
        }
      } finally {
        clearTimeout(timer);
        context.signal?.removeEventListener("abort", cancel);
      }
      checkCancelled();
      checkBudget();
      await sleep(
        300 * 2 ** attempt + Math.floor(Math.random() * 100),
        context.signal,
      );
    }
    throw new QlooError(
      `Qloo ${traceBase.endpoint} retries exhausted.`,
      traceOf(),
      true,
    );
  } catch (err) {
    const failure =
      err instanceof QlooError || err instanceof QlooQuotaError
        ? err
        : new QlooError(
            context.signal?.aborted
              ? `Qloo ${traceBase.endpoint} request cancelled.`
              : `Qloo ${traceBase.endpoint} request failed.`,
            traceOf(),
            !context.signal?.aborted,
          );
    record(failure.trace, failure.message);
    throw failure;
  }
}

/**
 * Single authenticated GET against Qloo with retry, timeout, and a
 * §6.12 trace for the evidence drawer. Server-only: never import from
 * a Client Component and never expose the key to the browser.
 *
 * Legacy offline contract: without a key, no-context calls return a
 * deterministic mock payload with fromCache=true instead of throwing.
 * Context calls never mock: quota/cache are private to that context,
 * every HTTP attempt is charged, and cancellation covers fetch/backoff.
 * When supplied, context.calls receives key-free, bounded response traces.
 */
export async function qlooFetch(
  path: string,
  params: Record<string, string> = {},
  context?: QlooRequestContext,
): Promise<QlooFetchOk> {
  if (typeof window !== "undefined") {
    throw new Error("qlooFetch is server-only and cannot run in the browser.");
  }

  if (context !== undefined) return qlooFetchWithContext(path, params, context);

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
