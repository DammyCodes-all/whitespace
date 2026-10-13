/**
 * AI word-bridge scoring weights. Owned by S.
 *
 * Pure logic, no I/O, no AI: the model only points each leftover pitch
 * word at an already-fetched taste id plus a bucket (`bridge.ts`); the
 * fixed weights below turn buckets into numbers here, so our code
 * scores and the AI never does (§7). Buckets: strong 0.75, related
 * 0.5, distant 0 — distant renders as "considered, not counted" and
 * contributes zero. At most 4 bridges per run; pinned must-haves are
 * never bridged (exact-only). Every bridged id must already sit in the
 * run's fetched tastes, so §8 grounding holds with no new Qloo call.
 * Deterministic: same input, same output (§10 #7). Server-safe: no
 * window usage.
 *
 * Spec ref: §6.6 (weighted mean; pinned-x2 precedent for non-unit
 * weights), §7 (our code scores), §8 (grounding).
 */

import type { PitchTag } from "@/lib/types";
import type { WeightedTag } from "./fit.ts";

/** AI buckets for one leftover word pointing at a fetched taste id. */
export type BridgeBucket = "strong" | "related" | "distant";

/** Fixed bucket weights: distant is considered but counts zero. */
export const BRIDGE_WEIGHT_MAP: Record<BridgeBucket, number> = {
  strong: 0.75,
  related: 0.5,
  distant: 0,
};

/** At most this many bridges per run (drift control, cf. expansion). */
export const MAX_BRIDGES = 4;

/** One validated bridge: leftover word -> fetched taste id + bucket. */
export interface Bridge {
  /** Original pitch word, e.g. "lonely". */
  word: string;
  /** Already-fetched Qloo tag id, e.g. "urn:tag:mood:media:solitude". */
  qlooTagId: string;
  bucket: BridgeBucket;
}

/** True for exactly "strong", "related" or "distant" (nothing else). */
export function isBridgeBucket(value: unknown): value is BridgeBucket {
  return value === "strong" || value === "related" || value === "distant";
}

function cleanWord(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (trimmed === "" || trimmed.length > 80) return null;
  return trimmed;
}

/**
 * Strictly validate an AI bridge payload. The envelope must be
 * `{bridges: [{word, qlooTagId, bucket}]}`; every entry needs a
 * non-empty word, an id from `allowedIds` (already-fetched tastes —
 * nothing invented) and a known bucket. Anything else throws and the
 * caller runs on exact matches. Duplicates collapse to the first
 * occurrence; output caps at {@link MAX_BRIDGES}. Deterministic.
 */
export function toBridges(
  data: unknown,
  allowedIds: ReadonlySet<string>,
): Bridge[] {
  if (typeof data !== "object" || data === null) {
    throw new Error("Bridge JSON must be an object.");
  }
  const list = (data as Record<string, unknown>).bridges;
  if (!Array.isArray(list)) {
    throw new Error('Bridge JSON must hold a "bridges" array.');
  }
  const seenWords = new Set<string>();
  const seenIds = new Set<string>();
  const out: Bridge[] = [];
  for (const raw of list) {
    if (typeof raw !== "object" || raw === null) {
      throw new Error("Each bridge must be an object.");
    }
    const entry = raw as Record<string, unknown>;
    const word = cleanWord(entry.word);
    const qlooTagId =
      typeof entry.qlooTagId === "string" ? entry.qlooTagId.trim() : "";
    if (word === null) {
      throw new Error("Each bridge needs a non-empty word.");
    }
    if (qlooTagId === "") {
      throw new Error(`Bridge for "${word}" needs a Qloo tag id.`);
    }
    if (!isBridgeBucket(entry.bucket)) {
      throw new Error(`Bridge for "${word}" needs a known bucket.`);
    }
    if (!allowedIds.has(qlooTagId)) {
      throw new Error(`Bridge for "${word}" points outside fetched tastes.`);
    }
    const wordKey = word.toLowerCase();
    if (seenWords.has(wordKey) || seenIds.has(qlooTagId)) continue;
    seenWords.add(wordKey);
    seenIds.add(qlooTagId);
    out.push({ word, qlooTagId, bucket: entry.bucket });
    if (out.length >= MAX_BRIDGES) break;
  }
  return out;
}

/**
 * Leftover words for the bridge call: matched dictionary tags scoring
 * zero everywhere (id in no scored taste list), non-pinned (pinned
 * must-haves stay exact-only), not already given a second chance
 * (`coveredWords`, e.g. expansion words), pitch order, capped at
 * {@link MAX_BRIDGES}. Deterministic.
 */
export function selectLeftoverWords(
  pitchTags: readonly PitchTag[],
  heldIds: ReadonlySet<string>,
  coveredWords: ReadonlySet<string> = new Set(),
  cap: number = MAX_BRIDGES,
): string[] {
  const covered = new Set([...coveredWords].map((w) => w.toLowerCase()));
  const out: string[] = [];
  for (const tag of pitchTags) {
    if (tag.pinned) continue;
    if (heldIds.has(tag.qlooTagId)) continue;
    if (covered.has(tag.tag.toLowerCase())) continue;
    out.push(tag.tag);
    if (out.length >= cap) break;
  }
  return out;
}

/** Display label: every bridge renders, distant ones included. */
export function bridgeLabel(
  word: string,
  name: string,
  bucket: BridgeBucket,
): string {
  return `${word}→${name} (AI: ${bucket})`;
}

/**
 * Turn validated bridges into weighted tags following the
 * `WeightedTag` pattern (`fit.ts`): fixed bucket weights, pinned
 * false, label `word→Tag Name (AI: bucket)`. Distant-zero entries are
 * kept so they render as considered-but-zero (the scorer files them
 * under `zeroTags`, never `matchedTags`). Deterministic.
 */
export function bridgesToWeightedTags(
  bridges: readonly Bridge[],
  nameById: ReadonlyMap<string, string>,
): WeightedTag[] {
  return bridges.slice(0, MAX_BRIDGES).map((bridge) => ({
    tag: { tag: bridge.word, qlooTagId: bridge.qlooTagId, pinned: false },
    weight: BRIDGE_WEIGHT_MAP[bridge.bucket],
    label: bridgeLabel(
      bridge.word,
      nameById.get(bridge.qlooTagId) ?? bridge.qlooTagId,
      bridge.bucket,
    ),
  }));
}
