/**
 * Day 6.5 Q: per-domain tag namespaces. Owned by Q.
 *
 * Tastes (`./tastes.ts`) and tag resolve (`./resolve-tags.ts`) must scope
 * to the SAME namespaces, or pitch tags and audience tastes never share
 * an id and every score is a placeholder 0 (§6.6). Chosen by live probe
 * against hackathon Qloo (Oct 6, 2026):
 * - film genre+keyword/media: sci-fi set ranks `science_fiction` top-5,
 *   romcom set omits it; mood words resolve 8/10 in-scope.
 * - music genre:music+keyword/media: pop set ranks `pop` #1, ambient set
 *   ranks `ambient` #2; mood words resolve 8/10 in-scope.
 * Book/game reuse the film set untested — Day 10 calibration revisits.
 */

import type { WorkType } from "@/lib/types";

/** Comma-separated `filter.tag.types` value per domain. */
export const TAG_SCOPES: Record<WorkType, string> = {
  film: "urn:tag:genre:media,urn:tag:keyword:media",
  music: "urn:tag:genre:music,urn:tag:keyword:media",
  book: "urn:tag:genre:media,urn:tag:keyword:media",
  game: "urn:tag:genre:media,urn:tag:keyword:media",
};
