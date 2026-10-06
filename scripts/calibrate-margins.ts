/**
 * Day 10 S: margin calibration harness. Owned by S.
 *
 * Runs the Day 8 fixture pack through the real pipeline in one process
 * and prints the margin distributions §6.7 turns into verdict constants,
 * plus the §11 quota/cache accounting — the two numbers a live run must
 * justify before S swaps the stubs in `src/lib/policy/verdict.ts`.
 *
 * Offline it is deterministic (mock fetch payloads), live it is the real
 * calibration: set QLOO_API_KEY and QLOO_BASE_URL in the shell first —
 * the config reads process.env directly, no .env.local is loaded.
 *
 * Usage: node scripts/calibrate-margins.ts
 *
 * Spec ref: §6.7 (margins are findings from real runs, not defaults),
 * §6.10 (case section lists margins + cutoffs), §11 (quota), §10 #2
 * (nonsense pitches must not win).
 */

import { PITCH_PACK } from "../src/lib/fixtures/pitch-pack.ts";
import { runPipeline } from "../src/lib/pipeline/run.ts";
import { getQuotaUsage, resetQuota } from "../src/lib/qloo/client.ts";

for (const entry of PITCH_PACK) {
  resetQuota();
  const result = await runPipeline(entry.input);
  const quota = getQuotaUsage();
  console.log(
    JSON.stringify({
      pitch: entry.name,
      intended: entry.intended,
      verdict: result.verdict.verdict,
      inconclusiveReason: result.verdict.inconclusiveReason ?? null,
      topAudienceId: result.verdict.topAudienceId,
      surprise: result.verdict.surprise,
      clearsControl: result.verdict.clearsControl,
      marginTopVsSecond: result.verdict.marginTopVsSecond,
      marginTopVsControl: result.verdict.marginTopVsControl,
      coverage: result.coverage,
      groundingOk: result.grounding.ok,
      qlooCalls: quota.calls,
      qlooCached: quota.cached,
    }),
  );
}

console.log(
  "\nNote: with no QLOO_API_KEY these margins are the deterministic mock path,",
);
console.log(
  "not findings (§6.7). Rerun with a key to record margins v1 in verdict.ts.",
);
