/**
 * Day 9 Q: chatbot title-mark helper. Owned by Q.
 *
 * §6.11 turns the chatbot comparison into a measurement: every title in
 * the chatbot's answer is looked up in Qloo and marked found or
 * not-found. This wraps the Day 2 title resolver, so matching,
 * not-found and per-item never-throw semantics are identical to the
 * hypothesis path (§6.2, §8). The chatbot's prose is exempt from the
 * grounding check — only these marks are grounded (§8).
 *
 * Spec ref: §6.11 (found/not-found marks), §6.2 (resolve semantics),
 * §8 (one miss never fails the batch), §6.12 (every call traced),
 * §11 (caps guard quota).
 */

import type { QlooCall, ResolvedTitle, WorkType } from "@/lib/types";
import { cleanQueries } from "./resolve-shared.ts";
import { MAX_TITLE_QUERIES, resolveTitles } from "./resolve-titles.ts";

/** Same quota cap as title resolve: one `/search` call per title max. */
export const MAX_MARK_TITLES = MAX_TITLE_QUERIES;

export interface MarkTitlesResult {
  found: ResolvedTitle[];
  notFoundTitles: string[];
  calls: QlooCall[];
}

/**
 * §6.11: mark each chatbot-mentioned title found or not-found through
 * `resolveTitles`. Input is cleaned (trim, dedupe, cap) before resolve,
 * so the chatbot's raw list costs at most one `/search` call per unique
 * title (§11).
 */
export async function markChatbotTitles(
  titles: string[],
  workType: WorkType,
): Promise<MarkTitlesResult> {
  if (typeof window !== "undefined") {
    throw new Error(
      "markChatbotTitles is server-only and cannot run in the browser.",
    );
  }
  const cleaned = cleanQueries(titles, MAX_TITLE_QUERIES);
  if (cleaned.length === 0) {
    return { found: [], notFoundTitles: [], calls: [] };
  }
  const { resolved, notFoundTitles, calls } = await resolveTitles(
    cleaned,
    workType,
  );
  return { found: resolved, notFoundTitles, calls };
}
