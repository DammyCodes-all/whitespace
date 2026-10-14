/**
 * Package B: LLM tag extraction, one of the two things the LLM may do
 * (the other is wording the verdict). Owned by U.
 *
 * The model reads a pitch and proposes 5 to 8 descriptive words, each
 * copied from the pitch. It supplies no facts about any audience: no
 * names, no numbers, no comparisons. Every word is matched against a
 * real Qloo tag downstream by `resolvePitchTags`, so a word Qloo does
 * not hold is "not found in Qloo" and never enters scoring (§6.5).
 * Similar-title suggestions come from Qloo (`suggestTitles`), never
 * from the model (§7).
 *
 * JSON only, validated and capped. Server-only: keys stay server-side.
 *
 * Spec ref: §7 (AI proposes words, Qloo disposes), §6.5 (pitch tags),
 * §6.2 (similar-to titles, user-confirmed).
 */

import type { WorkType } from "@/lib/types";
import { TAG_WORDS } from "../config.ts";
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
  if (words.length < TAG_WORDS.min) {
    throw new LlmError(
      `LLM returned fewer than ${TAG_WORDS.min} usable tags.`,
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

function systemPrompt(): string {
  return [
    "You read a creator's pitch and pull out its descriptive words and its type.",
    "Reply with JSON ONLY, no markdown, no prose, matching this shape exactly:",
    '{"tags":["word1","word2","more words"],"workType":"film"}',
    `Rules: tags between ${TAG_WORDS.min} and ${TAG_WORDS.max} words, lowercase, single concepts.`,
    "Each word must appear in the pitch. Prefer concrete, distinctive words taste data uses (technologies, creatures, occupations, settings: android, hacker, coastal town) over generic genre labels (thriller, drama); use mood adjectives sparingly, at most one.",
    'workType is exactly one of "film", "music", "book", "game" — whichever the pitch itself describes.',
    "Never invent a word that is not in the pitch. No titles, no ids, no numbers. No claims about audiences.",
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
  const pitchText = input.pitchText.trim().slice(0, 2000);
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
        "options" in attempt ? attempt.options : {},
      );
      return toTagProposal(JSON.parse(extractJson(content)));
    } catch (err) {
      lastError = err;
    }
  }
  if (lastError instanceof LlmError) throw lastError;
  throw new LlmError("LLM request failed.", "llm", true);
}
