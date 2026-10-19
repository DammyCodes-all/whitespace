/**
 * AI word-bridge proposal. Owned by U.
 *
 * Server-only: one narrow call mapping each leftover pitch word to an
 * already-fetched taste id plus a bucket (strong/related/distant), max
 * 4, or []. Fixed weights live in `@/lib/scoring/semantic` — the model
 * never scores (§7). Every target must come from the taste list handed
 * in (fetched Qloo ids, §8); anything else is malformed and throws
 * `LlmError`, which the caller treats as no-bridges so the run
 * continues on exact matches. Groq primary, OpenRouter fallback, same
 * transport as `propose.ts`/`extract-tags.ts`: JSON-only, low
 * temperature, capped output tokens.
 *
 * Spec ref: §7 (AI points, our code scores), §8 (grounding), §11
 * (caps guard quota).
 */

import type { AudienceTastes, WeightedTag } from "../scoring/fit.ts";
import { type Bridge, MAX_BRIDGES, toBridges } from "../scoring/semantic.ts";
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

/** One fetched taste the model may point at: id plus display name. */
export interface BridgeAvailable {
  id: string;
  name: string;
}

export interface BridgeRequest {
  /** Leftover words (already capped at MAX_BRIDGES by the caller). */
  words: string[];
  /** Already-fetched taste ids with display names for the prompt. */
  available: BridgeAvailable[];
}

/** Prompt-size bound: contenders-first order, strongest ranks first. */
export const MAX_BRIDGE_CANDIDATES = 400;
/**
 * Per-audience taste trim: only the strongest 15 ids per list reach the
 * prompt. Mirrors `EXPANSION_TOP_TASTES = 15`: ranks carry the signal,
 * so cutting the long tail shortens the ~6k-char prompt and gives
 * constrained decoding (`response_format: json_object`) better odds of
 * validating instead of failing with `json_validate_failed`.
 */
export const BRIDGE_PER_LIST_TASTES = 15;
/** Small JSON out: at most 4 bridges. */
export const BRIDGE_MAX_TOKENS = 1500;
/** Deterministic pointing, not prose. */
export const BRIDGE_TEMPERATURE = 0;

export function isBridgeConfigured(): boolean {
  return (
    readEnv("GROQ_API_KEY") !== null || readEnv("OPENROUTER_API_KEY") !== null
  );
}

/**
 * Dedupe fetched tastes into the candidate list, preserving first-seen
 * order (callers pass contenders first; taste lists run strongest
 * first). Only the first 15 ids per audience list are taken (cf.
 * `BRIDGE_PER_LIST_TASTES`): the long tail bloats the prompt and hurts
 * constrained-decoding odds, while ranks carry the signal. Names fall
 * back to the id when the parallel `tagNames` are absent or misaligned.
 * Pure, no I/O — exported for unit tests.
 */
export function availableFromTastes(
  tastes: readonly AudienceTastes[],
  cap: number = MAX_BRIDGE_CANDIDATES,
): BridgeAvailable[] {
  const seen = new Set<string>();
  const out: BridgeAvailable[] = [];
  for (const taste of tastes) {
    const aligned =
      taste.tagNames !== undefined &&
      taste.tagNames.length === taste.tagIds.length;
    const take = Math.min(taste.tagIds.length, BRIDGE_PER_LIST_TASTES);
    for (let index = 0; index < take; index += 1) {
      const id = taste.tagIds[index];
      if (seen.has(id)) continue;
      seen.add(id);
      let name = id;
      if (aligned) {
        const candidate = (taste.tagNames as string[])[index];
        if (typeof candidate === "string" && candidate.trim() !== "") {
          name = candidate;
        }
      }
      out.push({ id, name });
      if (out.length >= cap) return out;
    }
  }
  return out;
}

/** Display names keyed by tag id. Pure, no I/O. */
export function namesById(
  available: readonly BridgeAvailable[],
): Map<string, string> {
  return new Map(available.map((a) => [a.id, a.name]));
}

/**
 * §6.6: keep only the bridges a contender actually holds. A weighted
 * bridge that no contender holds can only dilute the weighted mean —
 * every audience's denominator grows and no numerator does — so it is
 * dropped rather than scored. Distance (weight 0) bridges stay: they
 * score nothing and stay visible as "considered, not counted".
 *
 * Pure, exported for unit tests.
 */
export function usableBridges(
  proposed: readonly WeightedTag[],
  contenderTagIds: ReadonlySet<string>,
): WeightedTag[] {
  return proposed.filter(
    (weighted) =>
      weighted.weight === 0 || contenderTagIds.has(weighted.tag.qlooTagId),
  );
}

function systemPrompt(): string {
  return [
    "You link unmatched pitch words to taste tags Qloo already returned.",
    "Reply with JSON ONLY, no markdown, no prose, matching this shape exactly:",
    '{"bridges":[{"word":"space","qlooTagId":"urn:tag:example","bucket":"related"}]}',
    `Rules: bridges at most ${MAX_BRIDGES}, one per word, or an empty list when nothing fits.`,
    "Each word must be copied exactly from the given words — never invent a word.",
    "Each qlooTagId must be copied exactly from the given tastes — never invent an id.",
    'Each bucket is exactly one of "strong", "related" or "distant": strong means nearly the same thing, related means associated, distant means considered but not counted.',
  ].join("\n");
}

/** Prompt builder; exported for unit tests (pure, no I/O). */
export function buildBridgeMessages(
  words: readonly string[],
  available: readonly BridgeAvailable[],
): ChatMessage[] {
  const tastes = available.map((a) => `${a.id} — ${a.name}`).join("\n");
  return [
    { role: "system", content: systemPrompt() },
    {
      role: "user",
      content: [`Words: ${words.join(", ")}`, "Tastes:", tastes].join("\n"),
    },
  ];
}

/**
 * Strictly validate an AI bridge payload: shape and fetched-id check
 * via `toBridges`, plus every word must be one of the leftover words
 * asked for (normalized to the requested spelling). Throws `LlmError`
 * on anything malformed — the caller treats that as no-bridges. Pure,
 * no I/O — exported for unit tests.
 */
export function toBridgeResult(
  data: unknown,
  allowedIds: ReadonlySet<string>,
  words: readonly string[],
): Bridge[] {
  let bridges: Bridge[];
  try {
    bridges = toBridges(data, allowedIds);
  } catch (err) {
    throw new LlmError(
      err instanceof Error ? err.message : "Malformed bridge JSON.",
      "parse",
      true,
    );
  }
  const wanted = new Map(words.map((w) => [w.toLowerCase(), w]));
  return bridges.map((bridge) => {
    const original = wanted.get(bridge.word.toLowerCase());
    if (original === undefined) {
      throw new LlmError(
        `Bridge word "${bridge.word}" was not asked for.`,
        "parse",
        true,
      );
    }
    return { ...bridge, word: original };
  });
}

function parseBridgeContent(content: string): unknown {
  try {
    return JSON.parse(extractJson(content)) as unknown;
  } catch {
    throw new LlmError("LLM returned invalid bridge JSON.", "parse", true);
  }
}

/**
 * Point leftover words at fetched taste ids. Tries Groq first, then
 * OpenRouter. Throws `LlmError` on malformed output or transport
 * failure — never returns unvalidated output. Server-only: keys stay
 * server-side.
 */
export async function proposeBridges(
  request: BridgeRequest,
): Promise<Bridge[]> {
  if (typeof window !== "undefined") {
    throw new Error("proposeBridges is server-only.");
  }
  const words = [
    ...new Set(request.words.map((w) => w.trim()).filter(Boolean)),
  ].slice(0, MAX_BRIDGES);
  if (words.length === 0 || request.available.length === 0) return [];
  const available = request.available.slice(0, MAX_BRIDGE_CANDIDATES);
  const allowedIds = new Set(available.map((a) => a.id));
  const messages = buildBridgeMessages(words, available);

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
        { temperature: BRIDGE_TEMPERATURE, maxTokens: BRIDGE_MAX_TOKENS },
      );
      return toBridgeResult(parseBridgeContent(content), allowedIds, words);
    } catch (err) {
      lastError = err;
    }
  }
  if (openRouterKey !== null) {
    try {
      const model = readEnv("OPENROUTER_MODEL") ?? OPENROUTER_DEFAULT_MODEL;
      const appUrl = readEnv("NEXT_PUBLIC_APP_URL") ?? "http://localhost:3000";
      const content = await callChatCompletions(
        OPENROUTER_URL,
        openRouterKey,
        model,
        messages,
        "openrouter",
        {
          temperature: BRIDGE_TEMPERATURE,
          maxTokens: BRIDGE_MAX_TOKENS,
          timeoutMs: OPENROUTER_TIMEOUT_MS,
          extraHeaders: { "HTTP-Referer": appUrl, "X-Title": "Whitespace" },
        },
      );
      return toBridgeResult(parseBridgeContent(content), allowedIds, words);
    } catch (err) {
      lastError = err;
    }
  }
  if (lastError instanceof LlmError) throw lastError;
  throw new LlmError("LLM request failed.", "llm", true);
}
