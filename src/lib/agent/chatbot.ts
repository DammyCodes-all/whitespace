/**
 * Day 9 U: plain chatbot answer call. Owned by U.
 *
 * §6.11 sends the same pitch to the same model with no Qloo tools and a
 * plain request: who is this for and where do I find them. The answer
 * appears beside the Whitespace result; every title in it is then marked
 * found/not-found by Q's `markChatbotTitles` (§6.11), which turns the
 * comparison into a measurement, not a claim.
 *
 * Deliberately ungrounded (§8 exemption): this is the point — it shows
 * what the model says without Qloo. Never scores, never ranks (§7).
 * Reuses the Day 6.5 transport (`./llm-client.ts`): Groq primary,
 * OpenRouter fallback. Keyless throws `LlmError` with `configured=false`
 * and the UI renders "unavailable", never fixtures — fixtures would fake
 * the comparison.
 *
 * Spec ref: §6.11 (chatbot comparison), §7 (AI writes prose, never
 * ranks), §8 (grounding exemption), §11 (caps guard quota).
 */

import type { WorkType } from "@/lib/types";
import {
  type ChatMessage,
  callChatCompletions,
  extractJson,
  GROQ_URL,
  LlmError,
  OPENROUTER_URL,
  readEnv,
} from "./llm-client.ts";

export interface ChatbotInput {
  pitchText: string;
  workType: WorkType;
}

export interface ChatbotResult {
  /** Plain prose: who this is for and where to find them. */
  answer: string;
  /** Titles the answer mentions, for Q's found/not-found marks. */
  titles: string[];
}

/** Quota guards: the answer is prose, the title list is what costs Qloo. */
export const MAX_CHATBOT_TITLES = 10;
export const MIN_CHATBOT_TITLES = 1;
export const MAX_ANSWER_CHARS = 2000;

function cleanTitles(values: unknown, cap: number): string[] {
  if (!Array.isArray(values)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    if (typeof raw !== "string") continue;
    const trimmed = raw.trim().replace(/\s+/g, " ");
    if (trimmed === "" || trimmed.length > 80) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
    if (out.length >= cap) break;
  }
  return out;
}

function systemPrompt(workType: WorkType): string {
  return [
    `A creator describes a ${workType} idea. Say who it is for and where to find them.`,
    "Use no tools and no data lookup: answer from general knowledge only.",
    "Reply with JSON ONLY, no markdown, no prose, matching this shape exactly:",
    '{"answer":"two to four sentences of plain advice","titles":["title1","title2","title3"]}',
    "Rules: answer is plain prose a creator can act on. titles lists every",
    `real ${workType} title the answer mentions or leans on, ${MIN_CHATBOT_TITLES} to ${MAX_CHATBOT_TITLES}. Titles are real titles only, never ids or numbers.`,
  ].join("\n");
}

/** Validated + capped; exported for unit tests (pure, no I/O). */
export function toChatbotResult(data: unknown): ChatbotResult {
  if (typeof data !== "object" || data === null) {
    throw new LlmError("LLM returned non-object JSON.", "parse", true);
  }
  const root = data as Record<string, unknown>;
  const answer = typeof root.answer === "string" ? root.answer.trim() : "";
  const titles = cleanTitles(root.titles, MAX_CHATBOT_TITLES);
  if (answer === "" || answer.length > MAX_ANSWER_CHARS) {
    throw new LlmError("LLM returned no usable answer.", "parse", true);
  }
  if (titles.length < MIN_CHATBOT_TITLES) {
    throw new LlmError("LLM returned no titles to mark.", "parse", true);
  }
  return { answer, titles };
}

/**
 * Answer the pitch with no Qloo tools. Tries Groq first, then
 * OpenRouter. Throws `LlmError`; never returns unvalidated output.
 * Server-only: the keys must never reach the browser.
 */
export async function answerChatbot(
  input: ChatbotInput,
): Promise<ChatbotResult> {
  if (typeof window !== "undefined") {
    throw new Error("answerChatbot is server-only.");
  }
  const pitchText = input.pitchText.trim().slice(0, 2000);
  if (pitchText === "") {
    throw new LlmError("Pitch text is empty.", "input", true);
  }
  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt(input.workType) },
    {
      role: "user",
      content: `Pitch (${input.workType}): ${pitchText}`,
    },
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

  let lastError: unknown = null;
  if (groqKey !== null) {
    try {
      const model = readEnv("GROQ_MODEL") ?? "openai/gpt-oss-120b";
      const content = await callChatCompletions(
        GROQ_URL,
        groqKey,
        model,
        messages,
        "groq",
        { temperature: 0.4, maxTokens: 800 },
      );
      return toChatbotResult(JSON.parse(extractJson(content)));
    } catch (err) {
      lastError = err;
    }
  }
  if (openRouterKey !== null) {
    try {
      const model =
        readEnv("OPENROUTER_MODEL") ?? "nvidia/nemotron-3-ultra-550b-a55b:free";
      const appUrl = readEnv("NEXT_PUBLIC_APP_URL") ?? "http://localhost:3000";
      const content = await callChatCompletions(
        OPENROUTER_URL,
        openRouterKey,
        model,
        messages,
        "openrouter",
        {
          temperature: 0.4,
          maxTokens: 800,
          extraHeaders: { "HTTP-Referer": appUrl, "X-Title": "Whitespace" },
        },
      );
      return toChatbotResult(JSON.parse(extractJson(content)));
    } catch (err) {
      lastError = err;
    }
  }
  if (lastError instanceof LlmError) throw lastError;
  throw new LlmError("LLM request failed.", "llm", true);
}
