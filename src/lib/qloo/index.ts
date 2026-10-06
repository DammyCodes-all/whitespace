/**
 * Day 6 Q: public Qloo seam. Owned by Q.
 *
 * Export-only barrel: no logic, no signature changes. S wires
 * `runPipeline()` against this file, never deep paths, so later
 * additions (Day 7 `related.ts`, Day 10 `location.ts`, Day 9 `mark.ts`)
 * extend here without breaking the seam.
 *
 * `qlooFetch` and config stay out on purpose: S consumes the wrappers,
 * which keep the §6.12 trace on every call. Trace types stay in
 * `@/lib/types` (frozen Day 1). `QlooError` is re-exported so S can
 * distinguish Qloo failures from programming errors.
 *
 * Spec ref: §7 (Qloo is the source of every number/tag/title), §8 (one
 * miss never fails the batch), §6.12 (every call traced), §11 (caps
 * guard quota).
 */

export type { ControlSeed } from "@/lib/qloo/control-seeds";
export type { BuildControlsResult } from "@/lib/qloo/controls";
export type { ResolveTagsResult } from "@/lib/qloo/resolve-tags";
export type { ResolveTitlesResult } from "@/lib/qloo/resolve-titles";
export type { BuildRivalsResult, RivalProposal } from "@/lib/qloo/rivals";
export type {
  FetchAllTastesResult,
  FetchTastesResult,
} from "@/lib/qloo/tastes";
export { QlooError } from "./client.ts";
export { CONTROL_SEEDS } from "./control-seeds.ts";
export {
  buildControls,
  CONTROL_COUNT,
  MAX_TITLES_PER_CONTROL,
} from "./controls.ts";
export { MAX_TAG_WORDS, resolvePitchTags } from "./resolve-tags.ts";
export {
  MAX_TITLE_QUERIES,
  resolveTitles,
  WORK_TYPE_TO_SEARCH_TYPES,
} from "./resolve-titles.ts";
export {
  buildRivals,
  MAX_TITLES_PER_RIVAL,
  MIN_VALID_RIVALS,
} from "./rivals.ts";
export {
  fetchAllAudienceTastes,
  fetchAudienceTastes,
  MAX_ENTITIES_PER_AUDIENCE,
  MAX_TASTE_AUDIENCES,
} from "./tastes.ts";
