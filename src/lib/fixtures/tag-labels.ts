/**
 * Day 7 gap display labels, now consumed by tests only
 * (`scoring/gaps.test.ts`, `qloo/related.test.ts`).
 *
 * LABELS-STUB: taste tag ids are URNs, not words. The live spike
 * arrived and resolved this: real names come from the Insights
 * response itself (`tastes.tagNames`) via `labelsForTastes`
 * (`gaps.ts`), and the live change route passes an empty fallback.
 * Consumers never changed, per plan. The map survives as readable
 * test fixture data over the `taste-lists.ts` URNs.
 *
 * Plain data only: must stay runnable under `node --test` type
 * stripping (no enums, no namespaces).
 */

export const TAG_LABELS: Record<string, string> = {
  "urn:tag:mood:media:bleak": "bleak",
  "urn:tag:mood:media:slow_burn": "slow-burn",
  "urn:tag:mood:media:cerebral": "cerebral",
  "urn:tag:mood:media:meditative": "meditative",
  "urn:tag:setting:media:space": "space",
  "urn:tag:mood:media:melancholy": "melancholy",
  "urn:tag:mood:media:dreamlike": "dreamlike",
  "urn:tag:theme:media:sacrifice": "sacrifice",
  "urn:tag:mood:media:noir": "noir",
  "urn:tag:mood:media:monumental": "monumental",
  "urn:tag:setting:media:desert": "desert",
  "urn:tag:theme:media:faith": "faith",
  "urn:tag:theme:media:consciousness": "consciousness",
  "urn:tag:mood:media:tender": "tender",
  "urn:tag:mood:media:uncanny": "uncanny",
  "urn:tag:mood:media:alien": "alien",
  "urn:tag:setting:media:frontier": "frontier",
  "urn:tag:mood:media:ascetic": "ascetic",
  "urn:tag:mood:media:paranoid": "paranoid",
  "urn:tag:mood:media:puzzling": "puzzling",
  "urn:tag:theme:media:solitude": "solitude",
  "urn:tag:mood:media:gentle": "gentle",
  "urn:tag:mood:media:restrained": "restrained",
  "urn:tag:mood:media:quiet": "quiet",
  "urn:tag:theme:media:grief": "grief",
  "urn:tag:mood:media:mournful": "mournful",
  "urn:tag:mood:media:archival": "archival",
  "urn:tag:mood:media:ambient": "ambient",
  "urn:tag:mood:media:textural": "textural",
  "urn:tag:mood:media:glacial": "glacial",
  "urn:tag:mood:media:pensive": "pensive",
  "urn:tag:mood:media:expansive": "expansive",
};
