/**
 * Plain-words display strings for the audience rows. §6.2 names the
 * concept ("named audience"); the spec never pins the on-screen word,
 * so the word names the source, not the role: the people who like the
 * similar titles the user picked. Work types read as the category
 * nouns a user would say out loud (Movies, Music, Books, Games),
 * never the internal enum.
 */
import type { WorkType } from "./types.ts";

/** Enum word → category noun the user said out loud. */
const CATEGORY_WORD: Record<WorkType, string> = {
  film: "Movies",
  music: "Music",
  book: "Books",
  game: "Games",
};

export function categoryWord(workType: WorkType): string {
  return CATEGORY_WORD[workType];
}

/** One display label reused everywhere the named audience row shows. */
export function namedAudienceLabel(workType: WorkType): string {
  return `People who like the ${categoryWord(workType)} you named`;
}
