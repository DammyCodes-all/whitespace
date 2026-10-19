/**
 * Package B: the one config file. Owned by S.
 *
 * Every tunable constant in the shipped flow lives here and nowhere
 * else. `policy/verdict.ts` and `qloo/controls.ts` re-export their old
 * names from this file so existing imports and tests keep working
 * without a second source of truth.
 *
 * Per the brief: tune after test runs, not to make a table look good.
 * The tie and surprise bars below are live-calibrated values from
 * `docs/qloo-coverage.md` (Margins v1, 2026-10-09), re-expressed as
 * SHARES on 2026-10-19 so they hold at any pool size. The flow gates
 * (MIN_MATCHED_TAGS, CANDIDATES) are the brief's stated values and are
 * NOT yet calibrated on real pitches.
 *
 * Recalibration note (2026-10-19): every absolute margin is gone. Fit
 * scores are a weighted mean over K pooled tags, so the SAME
 * relationship moved 0.180 (K=12) → 0.108 (K=20) → 0.036 (K=60) as the
 * pool grew — fixed numbers flipped Strong/Weak on pool size alone. The
 * control test is now rank-based (beat the measured field, no fixed
 * gap), and the tie, surprise and rise bars are shares of the score
 * they judge.
 *
 * Spec ref: §6.7 (verdict table and margins), §6.5 (pool gate), §6.4
 * (control count), §6.3 (candidate count), §11 (caps guard quota).
 */

/**
 * §6.7, display-only: a judged Strong/Weak verdict this close to the
 * control line reads as a close call (repeat probe 2026-10-12: gaps at
 * or below 0.03 are noise, wins at +0.055 still flip on LLM
 * rewording). The verdict itself never changes here — the UI just
 * says a re-run may read differently.
 */
export const CLOSE_CALL_GAP = 0.06;

/**
 * §6.7: "clearly ahead" is a SHARE of the winner's own score, not an
 * absolute gap. Same scale problem as the control margin, one branch
 * up: at K=60 a real 0.18 lead at K=12 reads as 0.036, so an absolute
 * 0.05 tie-margin would make every large pool Mixed forever. At the
 * calibrated K=12 magnitudes (0.89 vs 0.87) the share reproduces the old
 * absolute rule exactly, and it holds at every pool size.
 */
export const SPLIT_SHARE = 0.05;

/**
 * §6.7: a rival beats the named audience by this share of its own score
 * = surprise. Share, not absolute gap, for the same reason.
 */
export const SURPRISE_SHARE = 0.1;

/** §6.7: more than this share unjudgeable means Inconclusive, not Weak. */
export const MAX_UNJUDGEABLE_SHARE = 0.5;

/**
 * §6.7: a comparison field needs this many judgeable control audiences
 * before any verdict may be Strong. Below it the run abstains: "beats
 * 3 of 4" is not evidence. Placeholder zeros never count toward it
 * (§10 #4), so a degraded Qloo window abstains instead of guessing.
 */
export const MIN_JUDGEABLE_CONTROLS = 8;

/**
 * §6.7: the strongest comparison audience must hold at least this share
 * of the pooled tags, and never fewer than one. On a 3-tag pitch-only
 * set one hit is a third of the pool — a real bar; on a 60-tag pool one
 * hit is 1.7% — a lucky draw. A share, not a fixed count, for the same
 * reason everything else here is scale-free.
 */
export const MIN_CEILING_SHARE = 0.02;

/**
 * §6.9: a rewrite counts as a rise when it moves the fit by this share
 * of where the fit already stood, as well as by the absolute floor in
 * `policy/change.ts`. Same scale reason as the verdict bars: a rise is
 * worth ~0.02 on a 60-tag pool and ~0.09 on a 12-tag pool.
 */
export const MIN_RISE_SHARE = 0.1;

/** §6.5: share of suggested words that matched Qloo. DISPLAY-ONLY now. */
export const COVERAGE_FLOOR = 0.34;

/**
 * §6.5, pool gate: fewer pooled tags than this and the run stops as
 * Inconclusive without scoring. This is now the ONLY sufficiency gate —
 * the pitch-word coverage floor is display-only (2026-10-19), because
 * scoring runs on the pooled set (title gifts plus pitch tags), not on
 * the pitch words alone. Judge the meal, not the garnish.
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
 * AI word-bridges: on. The title-grounded pool scores
 * exact matches plus leftover-word bridges; when false, exact
 * matches only. Leftover pitch words get one narrow
 * LLM pass pointing each at an already-fetched taste id, appended to
 * the same shared list (existing behavior, unchanged).
 */
export const BRIDGES_ENABLED = true;

/** §6.5: words checked against Qloo tags per run. */
export const MAX_TAG_WORDS = 20;

/** Long enough to clear the judgement floor with headroom. */
export const TASTES_TAKE = "50";
