/**
 * Day 6.5 U: LLM proposal seam. Owned by U.
 *
 * Server-only: turns a pitch into the three things `runPipeline` needs
 * beyond `PitchInput` — confirmed "similar to" titles (§6.2), candidate
 * descriptive words (§6.5), and 3 rival readings (§6.3). Output is JSON
 * only; every title and word is grounded downstream by Qloo resolve
 * (misses become not-found, never scores), so the model must not invent
 * ids, only names (§7).
 *
 * Providers: Groq direct (free plan) primary, OpenRouter `:free`
 * fallback. Same OpenAI-compatible chat-completions shape, so one helper
 * serves both. Without keys it throws `LlmError` with `configured=false`
 * and the caller falls back to `demoPipelineInput` (§9).
 *
 * Spec ref: §7 (AI proposes, Qloo disposes), §6.2/§6.3/§6.5 (what is
 * proposed), §8 (grounding downstream), §11 (caps guard quota).
 */

import type { WorkType } from "@/lib/types";

export interface ProposeInput {
  pitchText: string;
  workType: WorkType;
}

export interface ProposeRival {
  id: string;
  name: string;
  reason: string;
  titles: string[];
}

export interface ProposeResult {
  /** 3 to 5 "similar to" titles (§6.2). */
  similarTitles: string[];
  /** 5 to 10 descriptive words (§6.5). */
  candidateWords: string[];
  /** Exactly 3 rival readings (§6.3). */
  rivalProposals: ProposeRival[];
}

export class LlmError extends Error {
  readonly provider: string;
  readonly configured: boolean;

  constructor(message: string, provider: string, configured = true) {
    super(message);
    this.name = "LlmError";
    this.provider = provider;
    this.configured = configured;
  }
}

/** Caps guard quota and prompt size (§11). */
export const MAX_SIMILAR_TITLES = 5;
export const MIN_SIMILAR_TITLES = 3;
export const MAX_CANDIDATE_WORDS = 10;
export const MIN_CANDIDATE_WORDS = 5;
export const RIVAL_COUNT = 3;
export const MAX_RIVAL_TITLES = 5;
export const MIN_RIVAL_TITLES = 3;

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

function readEnv(name: string): string | null {
  const value = process.env[name];
  return value === undefined || value.trim() === "" ? null : value.trim();
}

export function isLlmConfigured(): boolean {
  return (
    readEnv("GROQ_API_KEY") !== null || readEnv("OPENROUTER_API_KEY") !== null
  );
}

function cleanList(values: unknown, cap: number): string[] {
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
    `You read a creator's pitch for a ${workType} and propose audiences to test.`,
    "Reply with JSON ONLY, no markdown, no prose, matching this shape exactly:",
    '{"similarTitles":["title1","title2","title3"],',
    '"candidateWords":["word1","word2","word3"],',
    `"rivalProposals":[{"id":"rival-1","name":"short reading","reason":"one sentence","titles":["t1","t2","t3"]}]}`,
    `Rules: similarTitles ${MIN_SIMILAR_TITLES} to ${MAX_SIMILAR_TITLES} real, well-known ${workType} titles close to the pitch.`,
    `candidateWords ${MIN_CANDIDATE_WORDS} to ${MAX_CANDIDATE_WORDS} single descriptive words (genre, mood, setting, theme, format), lowercase, no names.`,
    `rivalProposals exactly ${RIVAL_COUNT} genuinely different readings of the same pitch, each with ${MIN_RIVAL_TITLES} to ${MAX_RIVAL_TITLES} real titles. Reasons are one sentence. Titles are real titles only, never ids or numbers.`,
  ].join("\n");
}

/** Strip markdown fences the model sometimes adds despite JSON-only. */
function extractJson(content: string): string {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = (fenced?.[1] ?? content).trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return raw;
  return raw.slice(start, end + 1);
}

/** Validated + capped; exported for unit tests (pure, no I/O). */
export function toResult(data: unknown): ProposeResult {
  if (typeof data !== "object" || data === null) {
    throw new LlmError("LLM returned non-object JSON.", "parse", true);
  }
  const root = data as Record<string, unknown>;
  const similarTitles = cleanList(root.similarTitles, MAX_SIMILAR_TITLES);
  const candidateWords = cleanList(root.candidateWords, MAX_CANDIDATE_WORDS);
  const rawRivals = Array.isArray(root.rivalProposals)
    ? root.rivalProposals.slice(0, RIVAL_COUNT)
    : [];
  const rivalProposals: ProposeRival[] = rawRivals.map(
    (raw: unknown, index: number) => {
      const r =
        typeof raw === "object" && raw !== null
          ? (raw as Record<string, unknown>)
          : {};
      const name =
        typeof r.name === "string" && r.name.trim() !== ""
          ? r.name.trim().slice(0, 80)
          : `Rival reading ${index + 1}`;
      const reason =
        typeof r.reason === "string" && r.reason.trim() !== ""
          ? r.reason.trim().slice(0, 200)
          : "An alternative reading of the same pitch.";
      return {
        id:
          typeof r.id === "string" && r.id.trim() !== ""
            ? r.id.trim().slice(0, 40)
            : `rival-${index + 1}`,
        name,
        reason,
        titles: cleanList(r.titles, MAX_RIVAL_TITLES),
      };
    },
  );

  if (similarTitles.length < MIN_SIMILAR_TITLES) {
    throw new LlmError("LLM returned too few similar titles.", "parse", true);
  }
  if (candidateWords.length < MIN_CANDIDATE_WORDS) {
    throw new LlmError("LLM returned too few candidate words.", "parse", true);
  }
  if (
    rivalProposals.length !== RIVAL_COUNT ||
    rivalProposals.some((r) => r.titles.length < MIN_RIVAL_TITLES)
  ) {
    throw new LlmError("LLM returned too few rival readings.", "parse", true);
  }
  return { similarTitles, candidateWords, rivalProposals };
}

interface ChatMessage {
  role: "system" | "user";
  content: string;
}

async function callChatCompletions(
  url: string,
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  provider: string,
  extraHeaders: Record<string, string> = {},
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        ...extraHeaders,
      },
      body: JSON.stringify({
        model,
        messages,
        response_format: { type: "json_object" },
        temperature: 0.2,
        max_tokens: 1200,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new LlmError(
        `${provider} failed with status ${res.status}.`,
        provider,
        true,
      );
    }
    const data: unknown = await res.json().catch(() => null);
    const content = (
      data as { choices?: { message?: { content?: unknown } }[] }
    )?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || content.trim() === "") {
      throw new LlmError(`${provider} returned no content.`, provider, true);
    }
    return content;
  } catch (err) {
    if (err instanceof LlmError) throw err;
    throw new LlmError(
      err instanceof Error && err.name === "AbortError"
        ? `${provider} timed out.`
        : `${provider} request failed.`,
      provider,
      true,
    );
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Propose similar titles, candidate words and rival readings for a pitch.
 * Tries Groq first, then OpenRouter. Throws `LlmError`; never returns
 * unvalidated output. Server-only: the keys must never reach the browser.
 */
export async function proposeProposals(
  input: ProposeInput,
): Promise<ProposeResult> {
  if (typeof window !== "undefined") {
    throw new Error("proposeProposals is server-only.");
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
      const model = readEnv("GROQ_MODEL") ?? "llama-3.3-70b-versatile";
      const content = await callChatCompletions(
        GROQ_URL,
        groqKey,
        model,
        messages,
        "groq",
      );
      return toResult(JSON.parse(extractJson(content)));
    } catch (err) {
      lastError = err;
    }
  }
  if (openRouterKey !== null) {
    try {
      const model =
        readEnv("OPENROUTER_MODEL") ?? "meta-llama/llama-3.3-70b-instruct:free";
      const appUrl = readEnv("NEXT_PUBLIC_APP_URL") ?? "http://localhost:3000";
      const content = await callChatCompletions(
        OPENROUTER_URL,
        openRouterKey,
        model,
        messages,
        "openrouter",
        { "HTTP-Referer": appUrl, "X-Title": "Whitespace" },
      );
      return toResult(JSON.parse(extractJson(content)));
    } catch (err) {
      lastError = err;
    }
  }
  if (lastError instanceof LlmError) throw lastError;
  throw new LlmError("LLM request failed.", "llm", true);
}
