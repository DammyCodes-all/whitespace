/**
 * Day 4 Q: control audiences. Owned by Q.
 *
 * Controls show what a meaningless match looks like (§6.4): about 20
 * audiences from unrelated material in the same domain (seeds live in
 * `./control-seeds.ts`). The verdict clears only when a contender beats
 * the best control by a clear margin (§6.7).
 *
 * Every seed title is checked via Day 2 `resolveTitles`; misses are
 * dropped, and a control with nothing resolved is reported (not kept):
 * an empty control would score a placeholder 0 and drag the ceiling down
 * to meaninglessness. Without an API key every seed lands there —
 * fixtures first, the live spike fills the coverage doc
 * (`docs/qloo-coverage.md`) and picks the domain.
 *
 * Quota note (§11): 20 controls × 3 titles = up to 60 `/search` calls per
 * run. Day 8 adds the cache guard; until then prefer saved runs for the
 * demo (§9).
 *
 * Spec ref: §6.4 (controls), §6.2 (drop what does not resolve), §8 (one
 * miss never fails the batch), §6.12 (every call traced).
 */

import type { Audience, QlooCall, WorkType } from "@/lib/types";
import { CONTROL_SEEDS } from "./control-seeds.ts";
import { resolveTitles } from "./resolve.ts";

export type { ControlSeed } from "@/lib/qloo/control-seeds";
export { CONTROL_SEEDS } from "./control-seeds.ts";

/** §6.4: about 20 controls per run. */
export const CONTROL_COUNT = 20;

/** Titles resolved per control: enough to signal, few enough for quota. */
export const MAX_TITLES_PER_CONTROL = 3;

export interface BuildControlsResult {
  controls: Audience[];
  /** Seeds with nothing resolved in Qloo: reported, not kept. */
  droppedControls: string[];
  calls: QlooCall[];
}

/**
 * §6.4: build control audiences for one domain. Resolves each seed's
 * titles, keeps controls with at least one resolved title, reports the
 * rest. Never throws on Qloo failure: the batch always resolves.
 */
export async function buildControls(
  workType: WorkType,
  count: number = CONTROL_COUNT,
): Promise<BuildControlsResult> {
  if (typeof window !== "undefined") {
    throw new Error(
      "buildControls is server-only and cannot run in the browser.",
    );
  }
  const controls: Audience[] = [];
  const droppedControls: string[] = [];
  const calls: QlooCall[] = [];

  for (const [index, seed] of CONTROL_SEEDS[workType]
    .slice(0, count)
    .entries()) {
    const {
      resolved,
      notFoundTitles,
      calls: itemCalls,
    } = await resolveTitles(
      seed.titles.slice(0, MAX_TITLES_PER_CONTROL),
      workType,
    );
    calls.push(...itemCalls);
    if (resolved.length === 0) {
      droppedControls.push(seed.name);
      continue;
    }
    controls.push({
      id: `control-${index + 1}`,
      kind: "control",
      name: seed.name,
      titles: resolved,
      notFoundTitles,
    });
  }

  return { controls, droppedControls, calls };
}
