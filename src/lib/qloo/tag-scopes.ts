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
 * - Day 10 calibration widened all domains to also include mood/theme/setting
 *   so taste-shaped pitch words share a namespace with audience tastes.
 * - 2026-10-12: game moved to Qloo's own (`:qloo`) namespaces. Live probe:
 *   a game entity's tastes are 50 rich tags unscoped but collapse to 19
 *   genre labels under media scopes, while game-pitch words (lighthouse,
 *   hacker, android, monastery, detective…) resolve exactly in
 *   `setting:qloo` / `keyword:qloo`. Media scopes stay for film/book;
 *   book entities return 0 taste tags even unscoped (hackathon data gap,
 *   not a scope bug) so book keeps the film set pending Qloo data.
 */

import type { WorkType } from "@/lib/types";

/** Comma-separated `filter.tag.types` value per domain. */
export const TAG_SCOPES: Record<WorkType, string> = {
  film: "urn:tag:genre:media,urn:tag:keyword:media,urn:tag:mood:media,urn:tag:theme:media,urn:tag:setting:media",
  music:
    "urn:tag:genre:music,urn:tag:keyword:media,urn:tag:mood:media,urn:tag:theme:media,urn:tag:setting:media",
  book: "urn:tag:genre:media,urn:tag:keyword:media,urn:tag:mood:media,urn:tag:theme:media,urn:tag:setting:media",
  game: "urn:tag:genre:qloo,urn:tag:keyword:qloo,urn:tag:mood:qloo,urn:tag:theme:qloo,urn:tag:setting:qloo,urn:tag:motif:qloo,urn:tag:plot:qloo,urn:tag:category:qloo,urn:tag:audience:qloo,urn:tag:occupation:qloo,urn:tag:content:qloo,urn:tag:style:qloo,urn:tag:archetype:qloo,urn:tag:subgenre:qloo,urn:tag:emotional_tone:qloo",
};
