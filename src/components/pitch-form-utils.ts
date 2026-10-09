/**
 * Shared bits for the pitch-form sections. Owned by U.
 *
 * Limits, the suggestion shape and word helpers live here so the shell
 * (`./pitch-form.tsx`) and the sections import them without cycles.
 */

export interface Suggestion {
  key: string;
  name: string;
}

/** §6.1: long pitches trim to roughly 300 words, with a notice. */
export const WORD_LIMIT = 300;

/** §6.1: up to five "nothing like" titles. */
export const NOTHING_LIKE_LIMIT = 5;

export function countWords(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean);
  return text.trim() === "" ? 0 : words.length;
}

export function trimToWords(text: string, limit: number): string {
  return text.trim().split(/\s+/).filter(Boolean).slice(0, limit).join(" ");
}
