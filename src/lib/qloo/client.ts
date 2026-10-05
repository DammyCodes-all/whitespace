/**
 * Qloo network boundary. Owned by Q.
 *
 * Day 1 scope only: authenticated GET + retry + timeout + evidence trace.
 * No taste logic, no rival logic, no scoring. Those land Day 2 to Day 5
 * in resolve.ts / tastes.ts / rivals.ts and build on this function.
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
  const timeoutMs = Number.parseInt(timeoutRaw, 10);
  const maxRetries = Number.parseInt(retriesRaw, 10);

  return {
    baseUrl: readEnv("QLOO_BASE_URL", "https://hackathon.api.qloo.com").replace(
      /\/$/,
      "",
    ),
    apiKey: process.env.QLOO_API_KEY ?? null,
    timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : 10000,
    maxRetries: Number.isFinite(maxRetries) ? Math.max(0, maxRetries) : 2,
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
      },
    };
  }

  const query = new URLSearchParams(params).toString();
  const url = `${config.baseUrl}${path}${query ? `?${query}` : ""}`;

  let attempt = 0;
  let lastStatus = 0;

  while (true) {
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
      lastStatus = res.status;
      const durationMs = Date.now() - started;

      if (res.ok) {
        const data: unknown = await res.json().catch(() => null);
        return {
          data,
          trace: {
            ...traceBase,
            status: res.status,
            durationMs,
            fromCache: false,
          },
        };
      }

      if (isRetryableStatus(res.status) && attempt < config.maxRetries) {
        attempt += 1;
        await sleep(300 * 2 ** (attempt - 1) + Math.floor(Math.random() * 100));
        continue;
      }

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
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof QlooError) throw err;
      const aborted =
        err instanceof Error &&
        (err.name === "AbortError" || err.message.includes("abort"));
      const durationMs = Date.now() - started;
      if (attempt < config.maxRetries && (!aborted || attempt === 0)) {
        attempt += 1;
        await sleep(300 * 2 ** (attempt - 1) + Math.floor(Math.random() * 100));
        continue;
      }
      throw new QlooError(
        aborted
          ? `Qloo ${path} timed out after ${config.timeoutMs}ms.`
          : `Qloo ${path} request failed.`,
        { ...traceBase, status: lastStatus, durationMs, fromCache: false },
        true,
      );
    } finally {
      clearTimeout(timer);
    }
  }
}
