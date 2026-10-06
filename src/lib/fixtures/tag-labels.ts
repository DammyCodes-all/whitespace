/**
 * Day 7 gap display labels. Owned by Q, consumed by S (`gaps.ts`).
 *
 * LABELS-STUB: taste tag ids are URNs, not words, and no live key
 * exists to resolve them. This hand-written map pairs every URN in
 * `taste-lists.ts` with its display label. The live spike replaces this
 * map with names from real Insights responses — never the consumers.
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
