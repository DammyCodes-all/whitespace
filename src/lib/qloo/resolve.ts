/**
 * Day 2 Q resolvers, split by concern (barrel). Owned by Q.
 *
 * - `./resolve-titles.ts`: title lookup (§6.2).
 * - `./resolve-tags.ts`: tag lookup (§6.5).
 * - `./resolve-shared.ts`: query cleaning both use.
 *
 * Re-exported here so existing imports (`@/lib/qloo/resolve`) and the
 * build plan's file refs keep working.
 */

export type { ResolveTagsResult } from "@/lib/qloo/resolve-tags";
export {
  MAX_TAG_WORDS,
  resolvePitchTags,
} from "@/lib/qloo/resolve-tags";
export type { ResolveTitlesResult } from "@/lib/qloo/resolve-titles";
export {
  MAX_TITLE_QUERIES,
  resolveTitles,
  WORK_TYPE_TO_SEARCH_TYPES,
} from "@/lib/qloo/resolve-titles";
