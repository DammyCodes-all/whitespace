/**
 * Day 3 pitch-tag fixtures. Owned by S.
 *
 * Stands in for Day 2 tag-matching output (skipped): words from a pitch
 * already resolved to real Qloo tag URNs. fit.test.ts scores these
 * against the Q-owned taste fixtures.
 *
 * Plain data only: must stay runnable under `node --test` type
 * stripping (relative `.ts` imports, no enums, no namespaces).
 */

import type { PitchTag } from "../types.ts";

/** Four matched tags; suggested six words, so coverage is 4 of 6. */
export const SAMPLE_PITCH_TAGS: PitchTag[] = [
  { tag: "slow-burn", qlooTagId: "urn:tag:mood:media:slow_burn", pinned: true },
  { tag: "space", qlooTagId: "urn:tag:setting:media:space", pinned: false },
  { tag: "solitude", qlooTagId: "urn:tag:theme:media:solitude", pinned: false },
  { tag: "quiet", qlooTagId: "urn:tag:mood:media:quiet", pinned: false },
];

export const SAMPLE_SUGGESTED_COUNT = 6;
