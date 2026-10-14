/**
 * Package B: the one config file. Owned by S.
 *
 * Every tunable constant in the shipped flow lives here and nowhere
 * else. `policy/verdict.ts` and `qloo/controls.ts` re-export their old
 * names from this file so existing imports and tests keep working
 * without a second source of truth.
 *
 * Per the brief: tune after test runs, not to make a table look good.
 * The verdict margins and coverage floor below are the live-calibrated
 * values from `docs/qloo-coverage.md` (Margins v1, 2026-10-09), carried
 * over unchanged. The flow gates (MIN_MATCHED_TAGS, CANDIDATES) are the
 * brief's stated values and are NOT yet calibrated on real pitches —
 * that is the 5-pitch run's job.
 *
 * Spec ref: §6.7 (verdict table and margins), §6.5 (tag gate), §6.4
 * (control count), §6.3 (candidate count), §11 (caps guard quota).
 */

/** §6.7: a top audience clears control only by this margin. */
export const MARGIN = 0.05;
export const CONTROL_MARGIN = MARGIN;

/**
 * §6.7, display-only: a judged Strong/Weak verdict this close to the
 * control line reads as a close call (repeat probe 2026-10-12: gaps at
 * or below 0.03 are noise, wins at +0.055 still flip on LLM
 * rewording). The verdict itself never changes here — the UI just
 * says a re-run may read differently.
 */
export const CLOSE_CALL_GAP = 0.06;

/** §6.7: the top two both clear control and sit within this of each other. */
export const SPLIT_MARGIN = 0.05;

/** §6.7: a rival beats the named audience by this much = surprise. */
export const SURPRISE_MARGIN = 0.1;

/** §6.7: more than this share unjudgeable means Inconclusive, not Weak. */
export const MAX_UNJUDGEABLE_SHARE = 0.5;

/** §6.5: share of suggested words that must match before scoring. */
export const COVERAGE_FLOOR = 0.34;

/**
 * Flow gate (brief step 2): fewer matched tags than this and the run
 * stops as Inconclusive without scoring. Kept beside the coverage floor:
 * the floor guards shares, this guards absolute coverage.
 */
export const MIN_MATCHED_TAGS = 3;

/** Flow step 3: candidates requested for one run. */
export const CANDIDATES = { min: 3, max: 5 } as const;

/** Flow step 2: descriptive tags extracted from the pitch. */
export const TAG_WORDS = { min: 5, max: 8 } as const;

/** §6.4: control audiences per run. */
export const CONTROL_COUNT = 20;

/** Package A3: control tag sets stay fresh for 30 minutes. */
export const CONTROL_CACHE_TTL_MS = 30 * 60 * 1000;

/** Reach plan: top interests per winning audience (§6.8). */
export const REACH_TRIM = 5;

/** §6.2: titles per audience signal, one per run. */
export const MAX_TITLES_PER_AUDIENCE = 5;

/**
 * AI word-bridges: off by default. The title-grounded pool scores
 * exact matches only; when true, leftover pitch words get one narrow
 * LLM pass pointing each at an already-fetched taste id, appended to
 * the same shared list (existing behavior, unchanged).
 */
export const BRIDGES_ENABLED = false;

/** §6.5: words checked against Qloo tags per run. */
export const MAX_TAG_WORDS = 20;

/** Long enough to clear the judgement floor with headroom. */
export const TASTES_TAKE = "50";
