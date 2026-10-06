/**
 * Day 5 U: saved-run store. Owned by U.
 *
 * Every run is saved so it can be replayed without calling Qloo again
 * (§6.12, §10 #6 speed, §10 #7 repeatability). The store holds full
 * `PipelineResult` JSON under `whitespace:run:<id>`: the Day 6 seam
 * saves live runs here, the demo pages load them back, and the Day 1
 * mocks stay as the built-in fallback when nothing is saved yet (§9).
 *
 * localStorage with an in-memory fallback: private-mode quotas throw on
 * write, SSR has no window at all, and neither may break a render.
 * Stored payloads are validated on load — a shape that is not a
 * `PipelineResult` reads back as null, never as a half run.
 *
 * Client-only: never call these functions during SSR/prerender. The
 * in-memory fallback is process-global, so server-side use would leak
 * saved runs across requests.
 *
 * Spec ref: §6.12 (saved runs), §10 #6 (10s saved demo), §9 (saved runs
 * as live-service fallback).
 */

import type { PipelineResult } from "@/lib/types";

const KEY_PREFIX = "whitespace:run:";

const memory: Map<string, string> = new Map();

function keyFor(id: string): string {
  return `${KEY_PREFIX}${id}`;
}

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Storage ids currently saved, oldest first (storage order). */
export function listRuns(): string[] {
  const store = storage();
  if (store === null) {
    return [...memory.keys()].map((k) => k.slice(KEY_PREFIX.length));
  }
  const ids: string[] = [];
  try {
    for (let i = 0; i < store.length; i += 1) {
      const key = store.key(i);
      if (key?.startsWith(KEY_PREFIX) === true) {
        ids.push(key.slice(KEY_PREFIX.length));
      }
    }
  } catch {
    return [];
  }
  return ids;
}

function isPipelineResult(value: unknown): value is PipelineResult {
  if (typeof value !== "object" || value === null) return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r.input === "object" &&
    r.input !== null &&
    typeof r.hypothesis === "object" &&
    r.hypothesis !== null &&
    Array.isArray(r.scores) &&
    typeof r.verdict === "object" &&
    r.verdict !== null &&
    Array.isArray(r.calls) &&
    Array.isArray(r.steps)
  );
}

/** Load a saved run, or null when missing, unreadable or misshapen. */
export function loadRun(id: string): PipelineResult | null {
  let raw: string | null = null;
  const store = storage();
  if (store === null) {
    raw = memory.get(keyFor(id)) ?? null;
  } else {
    try {
      raw = store.getItem(keyFor(id));
    } catch {
      return null;
    }
  }
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isPipelineResult(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Save a run for replay. Returns false when storage refused it. */
export function saveRun(id: string, result: PipelineResult): boolean {
  let raw: string;
  try {
    raw = JSON.stringify(result);
  } catch {
    return false;
  }
  const store = storage();
  if (store === null) {
    memory.set(keyFor(id), raw);
    return true;
  }
  try {
    store.setItem(keyFor(id), raw);
    return true;
  } catch {
    return false;
  }
}

/** Forget a saved run. Returns true when something was removed. */
export function deleteRun(id: string): boolean {
  const store = storage();
  if (store === null) {
    return memory.delete(keyFor(id));
  }
  try {
    if (store.getItem(keyFor(id)) === null) return false;
    store.removeItem(keyFor(id));
    return true;
  } catch {
    return false;
  }
}
