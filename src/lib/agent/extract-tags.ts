/**
 * Package B: LLM tag extraction, one of the two things the LLM may do
 * (the other is wording the verdict). Owned by U.
 *
 * The model reads a pitch and proposes 5 to 8 descriptive words, each
 * copied from the pitch. It supplies no facts about any audience: no
 * names, no numbers, no comparisons. Every word is matched against a
 * real Qloo tag downstream by `resolvePitchTags`, so a word Qloo does
 * not hold is "not found in Qloo" and never enters scoring (§6.5).
 *
 * JSON only, validated and capped. Server-only: keys stay server-side.
 *
 * Spec ref: §7 (AI proposes words, Qloo disposes), §6.5 (pitch tags).
 */

import type { WorkType } from "@/lib/types";
import { TAG_WORDS } from "../config.ts";
import {
  type ChatMessage,
  callChatCompletions,
  extractJson,
  GROQ_URL,
  LlmError,
  OPENROUTER_URL,
  readEnv,
} from "./llm-client.ts";

export { LlmError };

export interface ExtractTagsInput {
  pitchText: string;
  workType: WorkType;
}

/** Validated + capped; exported for unit tests (pure, no I/O). */
export function toTagWords(data: unknown): string[] {
  if (typeof data !== "object" || data === null) {
    throw new LlmError("LLM returned non-object JSON.", "parse", true);
  }
  const raw = (data as Record<string, unknown>).tags;
  if (!Array.isArray(raw)) {
    throw new LlmError("LLM returned no tags array.", "parse", true);
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of raw) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim().toLowerCase().replace(/\s+/g, " ");
    if (trimmed === "" || trimmed.length > 60) continue;
    const key = trimmed.replace(/[_-]+/g, " ");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
    if (out.length >= TAG_WORDS.max) break;
  }
  if (out.length < TAG_WORDS.min) {
    throw new LlmError(
      `LLM returned fewer than ${TAG_WORDS.min} usable tags.`,
      "parse",
      true,
    );
  }
  return out;
}

function systemPrompt(workType: WorkType): string {
  return [
    `You read a creator's pitch for a ${workType} and pull out its descriptive words.`,
    "Reply with JSON ONLY, no markdown, no prose, matching this shape exactly:",
    '{"tags":["word1","word2","more words"]}',
    `Rules: between ${TAG_WORDS.min} and ${TAG_WORDS.max} words, lowercase, single concepts.`,
    "Each word must appear in the pitch. Prefer genre, theme, setting and tone words taste data uses.",
    "Never invent a word that is not in the pitch. No names, no numbers, no claims about audiences.",
  ].join("\n");
}

/**
 * Propose 5 to 8 descriptive words for a pitch. Tries Groq first, then
 * OpenRouter. Throws `LlmError`; never returns unvalidated output.
 */
export async function extractPitchTags(
  input: ExtractTagsInput,
): Promise<string[]> {
  if (typeof window !== "undefined") {
    throw new Error("extractPitchTags is server-only.");
  }
  const pitchText = input.pitchText.trim().slice(0, 2000);
  if (pitchText === "") {
    throw new LlmError("Pitch text is empty.", "input", true);
  }
  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt(input.workType) },
    { role: "user", content: `Pitch (${input.workType}): ${pitchText}` },
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
      model:
        readEnv("OPENROUTER_MODEL") ?? "nvidia/nemotron-3-ultra-550b-a55b:free",
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
      );
      return toTagWords(JSON.parse(extractJson(content)));
    } catch (err) {
      lastError = err;
    }
  }
  if (lastError instanceof LlmError) throw lastError;
  throw new LlmError("LLM request failed.", "llm", true);
}
