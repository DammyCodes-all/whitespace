/**
 * Package B: LLM tag extraction, one of the two things the LLM may do
 * (the other is wording the verdict). Owned by U.
 *
 * The model reads a pitch and proposes 5 to 8 descriptive words
 * about it. It supplies no facts about any audience: no
 * names, no numbers, no comparisons. Every word is matched against a
 * real Qloo tag downstream by `resolvePitchTags`, so a word Qloo does
 * not hold is "not found in Qloo" and never enters scoring (§6.5).
 * Similar-title suggestions come from Qloo (`suggestFromEntities`), never
 * from the model (§7).
 *
 * JSON only, validated and capped. Server-only: keys stay server-side.
 *
 * Spec ref: §7 (AI proposes words, Qloo disposes), §6.5 (pitch tags),
 * §6.2 (similar-to titles, user-confirmed).
 */

import type { WorkType } from "@/lib/types";
import { MIN_MATCHED_TAGS, TAG_WORDS } from "../config.ts";
import {
  type ChatMessage,
  callChatCompletions,
  extractJson,
  GROQ_URL,
  LlmError,
  OPENROUTER_DEFAULT_MODEL,
  OPENROUTER_TIMEOUT_MS,
  OPENROUTER_URL,
  readEnv,
} from "./llm-client.ts";

export { LlmError };

export interface ExtractTagsInput {
  pitchText: string;
}

export interface TagProposal {
  words: string[];
  /** The pitch's own type, read from the pitch — never a user control. */
  workType: WorkType;
}

const WORK_TYPES: WorkType[] = ["film", "music", "book", "game"];

/**
 * Slot count the prompt demands. Fixed (not a range) so the scoring
 * denominator is comparable run to run: "5 to 8" swung it by 60% and
 * that variance is what moved verdicts in the 2026-10-12 repeatability
 * probe (`docs/qloo-coverage.md`).
 */
const WANTED_TAG_COUNT = TAG_WORDS.max - 1;

/**
 * Floor for accepting a reply. The flow's real gate is
 * `MIN_MATCHED_TAGS` matched tags, so a short-but-valid proposal should
 * reach the chips and let that gate decide, not fail as a 502. Spec
 * §6.1 asks the call for its words; §6.5 gates matching.
 */
const MIN_USABLE_TAGS = Math.min(TAG_WORDS.min, MIN_MATCHED_TAGS);

/** Deterministic extraction: same pitch, same words (cf. `PICK_TEMPERATURE`). */
export const EXTRACT_TEMPERATURE = 0;

/** Validated + capped; exported for unit tests (pure, no I/O). */
export function toTagProposal(data: unknown): TagProposal {
  if (typeof data !== "object" || data === null) {
    throw new LlmError("LLM returned non-object JSON.", "parse", true);
  }
  const root = data as Record<string, unknown>;
  const raw = root.tags;
  if (!Array.isArray(raw)) {
    throw new LlmError("LLM returned no tags array.", "parse", true);
  }
  const seen = new Set<string>();
  const words: string[] = [];
  for (const value of raw) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim().toLowerCase().replace(/\s+/g, " ");
    if (trimmed === "" || trimmed.length > 60) continue;
    const key = trimmed.replace(/[_-]+/g, " ");
    if (seen.has(key)) continue;
    seen.add(key);
    words.push(trimmed);
    if (words.length >= TAG_WORDS.max) break;
  }
  if (words.length < MIN_USABLE_TAGS) {
    throw new LlmError(
      `LLM returned fewer than ${MIN_USABLE_TAGS} usable tags.`,
      "parse",
      true,
    );
  }
  const workType = root.workType;
  if (
    typeof workType !== "string" ||
    !WORK_TYPES.includes(workType as WorkType)
  ) {
    throw new LlmError("LLM returned no valid work type.", "parse", true);
  }
  return {
    words,
    workType: workType as WorkType,
  };
}

/** Prompt builder; exported for unit tests (pure, no I/O). */
export function systemPrompt(): string {
  return [
    "You read a creator's pitch and name what it is about, in words Qloo's tag dictionary already uses.",
    "Reply with JSON ONLY, no markdown, no prose, matching this shape exactly:",
    '{"tags":["word1","word2","more words"],"workType":"film"}',
    `Return exactly ${WANTED_TAG_COUNT} tags. They describe what the pitch is about — they do NOT need to appear in it: 'heist' is right for a casino-robbery pitch that never says heist.`,
    "Form matters: singular nouns or short noun phrases, lowercase, no plurals, no verbs, no -ing words unless that is the name of the thing. Use the plainest everyday name for a thing, never a literary paraphrase — 'small town' not 'close-knit rural backwater', 'detective' not 'investigator of secrets'.",
    "Budget the slots: two specific genre or subgenre keywords (cyberpunk, folk horror, neo-noir — never broad buckets like thriller or drama), two settings, places or occupations, two themes or situations (betrayal, grief, redemption, undercover, based on true story), and at most one mood word.",
    "Skip anything you would expect to be absent from a tag dictionary: invented proper nouns, coined compounds, poetic phrasing. If a concept has a plainer everyday name, use that name instead.",
    'workType is exactly one of "film", "music", "book", "game" — whichever the pitch itself describes. A series, short or TV film is "film".',
    "Never name something the pitch is not about. No titles, no ids, no numbers. No claims about audiences.",
  ].join("\n");
}

/**
 * Propose 5 to 8 descriptive words and the pitch's type. Tries Groq first, then OpenRouter. Throws `LlmError`;
 * never returns unvalidated output.
 */
export async function extractPitchTags(
  input: ExtractTagsInput,
): Promise<TagProposal> {
  if (typeof window !== "undefined") {
    throw new Error("extractPitchTags is server-only.");
  }
  const pitchText = input.pitchText.trim().slice(0, 4000);
  if (pitchText === "") {
    throw new LlmError("Pitch text is empty.", "input", true);
  }
  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt() },
    { role: "user", content: `Pitch: ${pitchText}` },
  ];

  const groqKey = readEnv("GROQ_API_KEY");
  const openRouterKey = readEnv("OPENROUTER_API_KEY");
  if (groqKey === null && openRouterKey === null) {
    throw new LlmError(
      "No LLM key set (GROQ_API_KEY or OPENROUTER_API_KEY).",
      "config",
      false,
    );
  }

  const attempts = [
    {
      provider: "groq" as const,
      key: groqKey,
      url: GROQ_URL,
      model: readEnv("GROQ_MODEL") ?? "openai/gpt-oss-120b",
    },
    {
      provider: "openrouter" as const,
      key: openRouterKey,
      url: OPENROUTER_URL,
      model: readEnv("OPENROUTER_MODEL") ?? OPENROUTER_DEFAULT_MODEL,
      options: { timeoutMs: OPENROUTER_TIMEOUT_MS } as const,
    },
  ];

  let lastError: unknown = null;
  for (const attempt of attempts) {
    if (attempt.key === null) continue;
    try {
      const content = await callChatCompletions(
        attempt.url,
        attempt.key,
        attempt.model,
        messages,
        attempt.provider,
        {
          temperature: EXTRACT_TEMPERATURE,
          ...("options" in attempt ? attempt.options : {}),
        },
      );
      return toTagProposal(JSON.parse(extractJson(content)));
    } catch (err) {
      lastError = err;
    }
  }
  if (lastError instanceof LlmError) throw lastError;
  throw new LlmError("LLM request failed.", "llm", true);
}
