/** Durable browser-only replay (§6.12). Never treats memory as persistence. */
import {
  isV2RunId,
  parseV2Result,
  v2ReplayId,
} from "../../components/v2-replay.ts";
import type { V2Result } from "../pipeline/v2/types.ts";

const KEY_PREFIX = "whitespace:v2:";
const LATEST_KEY = `${KEY_PREFIX}latest`;

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Invalidate before a new request, so failures cannot advertise an older run as latest. */
export function clearLatestV2Id(): boolean {
  const store = storage();
  if (store === null) return false;
  try {
    store.removeItem(LATEST_KEY);
    return store.getItem(LATEST_KEY) === null;
  } catch {
    return false;
  }
}

function quarantine(store: Storage, id: string): void {
  // Remove the bad artifact rather than retaining possibly unsafe payloads.
  try {
    store.removeItem(`${KEY_PREFIX}${id}`);
  } catch {
    /* Read will still reject it. */
  }
  try {
    if (store.getItem(LATEST_KEY) === id) store.removeItem(LATEST_KEY);
  } catch {
    /* Explicit run loads never fall back to another saved result. */
  }
}

export function saveV2Result(result: V2Result): boolean {
  clearLatestV2Id();
  const parsed = parseV2Result(result);
  const id = parsed === null ? null : v2ReplayId(parsed);
  const store = storage();
  if (store === null || !isV2RunId(id)) return false;
  try {
    const raw = JSON.stringify(parsed);
    store.setItem(`${KEY_PREFIX}${id}`, raw);
    if (store.getItem(`${KEY_PREFIX}${id}`) !== raw) return false;
    store.setItem(LATEST_KEY, id);
    if (store.getItem(LATEST_KEY) !== id) {
      clearLatestV2Id();
      return false;
    }
    return true;
  } catch {
    clearLatestV2Id();
    return false;
  }
}

/** Missing, malformed, and mismatched artifacts never enter the render tree. */
export function loadV2Result(id: string): V2Result | null {
  if (!isV2RunId(id)) return null;
  const store = storage();
  if (store === null) return null;
  let raw: string | null;
  try {
    raw = store.getItem(`${KEY_PREFIX}${id}`);
  } catch {
    return null;
  }
  if (raw === null) {
    quarantine(store, id);
    return null;
  }
  try {
    const result = parseV2Result(JSON.parse(raw));
    if (result !== null && v2ReplayId(result) === id) return result;
  } catch {
    /* Quarantine malformed JSON too. */
  }
  quarantine(store, id);
  return null;
}

/** Last *saved* result only. Callers must not imply that it is the latest attempted run. */
export function latestV2Id(): string | null {
  const store = storage();
  if (store === null) return null;
  try {
    const id = store.getItem(LATEST_KEY);
    if (!isV2RunId(id)) {
      store.removeItem(LATEST_KEY);
      return null;
    }
    return loadV2Result(id) === null ? null : id;
  } catch {
    return null;
  }
}
