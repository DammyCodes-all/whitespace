/**
 * Package A: control taste cache. Owned by Q.
 *
 * Control audiences do not depend on the pitch (§6.4), so their tag sets
 * are kept across runs keyed by pitch type, with a TTL. Scores are still
 * computed per pitch from the cached tag sets plus the current pitch
 * tags — the cache never stores a score.
 *
 * Cache key covers the seed count and the tag-scope string, so a scope
 * change or a different control count cannot serve stale tag sets.
 * Hits return deep clones with fresh trace ids marked `fromCache`, the
 * same honesty contract as the request cache in `./client.ts` (§6.12):
 * every displayed value still carries an evidence id.
 *
 * Package B will centralize this TTL with the other constants; it lives
 * here until then so this module has no new cross-package dependency.
 *
 * Spec ref: §6.4 (controls), §6.12 (evidence on cached data), §11
 * (quota).
 */

import type { AudienceTastes } from "../scoring/fit.ts";
import type { Audience, QlooCall, WorkType } from "../types.ts";
import { buildControls } from "./controls.ts";
import { TAG_SCOPES } from "./tag-scopes.ts";
import { fetchAllAudienceTastes } from "./tastes.ts";

/** Control tag sets stay fresh for 30 minutes. */
export const CONTROL_CACHE_TTL_MS = 30 * 60 * 1000;

interface ControlCacheEntry {
  fetchedAt: number;
  controls: Audience[];
  droppedControls: string[];
  tastes: AudienceTastes[];
  calls: QlooCall[];
}

const cache = new Map<string, ControlCacheEntry>();

/** Cache key: pitch type + control count + tag scope. */
export function controlCacheKey(workType: WorkType, count: number): string {
  return `${workType}:${count}:${TAG_SCOPES[workType]}`;
}

/** Drop all cached control tag sets (tests, and any explicit refresh). */
export function clearControlCache(): void {
  cache.clear();
}

function freshTraceId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `qloo-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

export interface LoadControlsResult {
  controls: Audience[];
  droppedControls: string[];
  /** Cached tag sets; score per pitch from these plus current tags. */
  tastes: AudienceTastes[];
  calls: QlooCall[];
  /** True when nothing was fetched and `calls` are re-issued traces. */
  fromCache: boolean;
}

/**
 * Control audiences plus their tag sets, from cache when fresh.
 * Never throws on Qloo failure: misses degrade to dropped/failed
 * entries exactly like the uncached path (§8).
 */
export async function loadControlTastes(
  workType: WorkType,
  count: number,
  now: number = Date.now(),
): Promise<LoadControlsResult> {
  if (typeof window !== "undefined") {
    throw new Error(
      "loadControlTastes is server-only and cannot run in the browser.",
    );
  }
  const key = controlCacheKey(workType, count);
  const hit = cache.get(key);
  if (hit !== undefined && now - hit.fetchedAt < CONTROL_CACHE_TTL_MS) {
    const at = new Date(now).toISOString();
    return {
      controls: structuredClone(hit.controls),
      droppedControls: [...hit.droppedControls],
      tastes: structuredClone(hit.tastes),
      calls: hit.calls.map((call) => ({
        ...call,
        id: freshTraceId(),
        fromCache: true,
        at,
      })),
      fromCache: true,
    };
  }
  const built = await buildControls(workType, count);
  const { all, calls: tasteCalls } = await fetchAllAudienceTastes(
    built.controls,
    workType,
  );
  cache.set(key, {
    fetchedAt: now,
    controls: structuredClone(built.controls),
    droppedControls: [...built.droppedControls],
    tastes: structuredClone(all),
    calls: [...built.calls, ...tasteCalls],
  });
  const stored = cache.get(key);
  if (stored === undefined) throw new Error("Control cache write failed.");
  return {
    controls: structuredClone(stored.controls),
    droppedControls: [...stored.droppedControls],
    tastes: structuredClone(stored.tastes),
    calls: stored.calls.map((call) => ({ ...call })),
    fromCache: false,
  };
}
