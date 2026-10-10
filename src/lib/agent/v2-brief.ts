/**
 * V2 brief + reference proposal (lean MVP). Owned by U.
 *
 * Turns a raw pitch into the structured brief and per-aspect reference
 * candidates the v2 pipeline needs. Server-only. Output is JSON only;
 * every excerpt is code-checked as an exact pitch substring, every
 * candidate name is resolved downstream by Qloo identity (misses become
 * not-found, never evidence). The model invents no ids, no scores, no
 * groups.
 *
 * Fidelity rules (§4A): negation, tone, form, and constraints survive;
 * no unstated genre or themes; a meaningless pitch returns zero
 * aspects with an unrepresentable note instead of a plausible brief.
 * At most one structured repair per stage (§6).
 *
 * Providers mirror the v1 seam: Groq primary, OpenRouter fallback.
 * Without keys it throws `LlmError` with `configured=false`.
 */

import type {
  V2Aspect,
  V2Brief,
  V2ReferenceCandidate,
} from "../pipeline/v2/types.ts";
import {
  type ChatMessage,
  callChatCompletions,
  extractJson,
  GROQ_URL,
  LlmError,
  type LlmExecutionContext,
  OPENROUTER_URL,
  readEnv,
} from "./llm-client.ts";

/** Up to three distinct discovery-relevant aspects (§4A). */
export const V2_MAX_ASPECTS = 3;

/** At most two reference candidates per aspect (§4B). */
export const V2_MAX_CANDIDATES = 2;

/** Entity types a reference candidate may carry. */
export const V2_REFERENCE_TYPES = [
  "urn:entity:movie",
  "urn:entity:book",
  "urn:entity:artist",
  "urn:entity:podcast",
  "urn:entity:person",
  "urn:entity:brand",
  "urn:entity:place",
  "urn:entity:videogame",
] as const;

export interface V2BriefProposal {
  brief: V2Brief;
  references: { aspectId: string; candidates: V2ReferenceCandidate[] }[];
}

/** Injectable chat transport: live providers by default, stubbed in tests. */
export type V2ChatTransport = (
  messages: ChatMessage[],
  execution?: LlmExecutionContext,
) => Promise<string>;

function systemPrompt(workType: string): string {
  return [
    `You read a creator's pitch for a ${workType}. Reply with JSON ONLY, no markdown, no prose:`,
    '{"interpretation":"one sentence, marked as your reading",',
    '"aspects":[{"facet":"premise|theme|tone|form","excerpt":"exact words from the pitch","interpretation":"what this aspect means"}],',
    '"constraints":["limits stated in the pitch"],"contrasts":["things the pitch says it is nothing like"],',
    '"unrepresentable":["distinctive aspects with no famous-work equivalent"],',
    `"references":[{"aspectIndex":0,"candidates":[{"name":"real work title","entityType":"one of ${V2_REFERENCE_TYPES.join(",")}","analogy":"one sentence on what aspect it represents"}]}]}`,
    `Rules: aspects at most ${V2_MAX_ASPECTS}, each a different facet, each excerpt copied exactly from the pitch (negation and tone preserved).`,
    `References at most ${V2_MAX_CANDIDATES} real, well-known candidates per aspect. Names only, never ids.`,
    "Never add unstated genre or themes to the pitch or its brief. You may propose reference works not named in the pitch, but each analogy must narrowly represent an extracted aspect and stays provisional until verified downstream.",
    "Do not repeat facets, excerpts, interpretations, or reference entries for an aspect. If the pitch is meaningless or has no representable content, return zero aspects and say so in unrepresentable.",
  ].join("\n");
}

function cleanStrings(values: unknown, cap: number, maxLen: number): string[] {
  if (!Array.isArray(values)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    if (typeof raw !== "string") continue;
    const trimmed = raw.trim().replace(/\s+/g, " ");
    if (trimmed === "" || trimmed.length > maxLen) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
    if (out.length >= cap) break;
  }
  return out;
}

function normalized(value: string): string {
  return value.normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * Validate + normalize raw model output against the pitch. Excerpts
 * must be exact substrings of the original input; anything else is a
 * fidelity failure, not a trim. Throws `LlmError` on any violation so
 * the caller runs the one structured repair (§4A).
 */
export function toV2BriefProposal(
  data: unknown,
  pitchText: string,
): V2BriefProposal {
  if (typeof data !== "object" || data === null) {
    throw new LlmError("LLM returned non-object JSON.", "parse", true);
  }
  const root = data as Record<string, unknown>;
  const interpretation =
    typeof root.interpretation === "string" ? root.interpretation.trim() : "";
  if (interpretation === "" || interpretation.length > 300) {
    throw new LlmError(
      "LLM brief interpretation missing or too long.",
      "parse",
      true,
    );
  }

  const rawAspects = Array.isArray(root.aspects) ? root.aspects : [];
  if (rawAspects.length > V2_MAX_ASPECTS) {
    throw new LlmError("LLM returned too many aspects.", "parse", true);
  }
  const facets = new Set(["premise", "theme", "tone", "form"]);
  const seenFacets = new Set<string>();
  const seenExcerpts = new Set<string>();
  const seenReadings = new Set<string>();
  const aspects: V2Aspect[] = rawAspects.map((raw: unknown, index: number) => {
    const a =
      typeof raw === "object" && raw !== null
        ? (raw as Record<string, unknown>)
        : {};
    const facet = typeof a.facet === "string" ? a.facet : "";
    if (!facets.has(facet)) {
      throw new LlmError(`LLM aspect ${index} has a bad facet.`, "parse", true);
    }
    const excerpt = typeof a.excerpt === "string" ? a.excerpt : "";
    if (
      excerpt.trim() === "" ||
      excerpt.length > 300 ||
      !pitchText.includes(excerpt)
    ) {
      throw new LlmError(
        `LLM aspect ${index} excerpt is not an exact pitch substring.`,
        "parse",
        true,
      );
    }
    const reading =
      typeof a.interpretation === "string" ? a.interpretation.trim() : "";
    if (reading === "" || reading.length > 300) {
      throw new LlmError(
        `LLM aspect ${index} interpretation missing or too long.`,
        "parse",
        true,
      );
    }
    const excerptKey = normalized(excerpt);
    const readingKey = normalized(reading);
    if (
      seenFacets.has(facet) ||
      seenExcerpts.has(excerptKey) ||
      seenReadings.has(readingKey)
    ) {
      throw new LlmError(
        `LLM aspect ${index} repeats a facet, excerpt, or interpretation.`,
        "parse",
        true,
      );
    }
    seenFacets.add(facet);
    seenExcerpts.add(excerptKey);
    seenReadings.add(readingKey);
    return {
      id: `a-${index + 1}`,
      facet: facet as V2Aspect["facet"],
      excerpt,
      interpretation: reading,
    };
  });

  const rawRefs = Array.isArray(root.references) ? root.references : [];
  const seenReferenceAspects = new Set<number>();
  const references = rawRefs.map((raw: unknown, index: number) => {
    const r =
      typeof raw === "object" && raw !== null
        ? (raw as Record<string, unknown>)
        : {};
    const aspectIndex = r.aspectIndex;
    if (
      typeof aspectIndex !== "number" ||
      !Number.isInteger(aspectIndex) ||
      aspectIndex < 0 ||
      aspectIndex >= aspects.length
    ) {
      throw new LlmError(
        `LLM reference ${index} points at no aspect.`,
        "parse",
        true,
      );
    }
    if (seenReferenceAspects.has(aspectIndex)) {
      throw new LlmError(
        `LLM reference ${index} repeats an aspect reference.`,
        "parse",
        true,
      );
    }
    seenReferenceAspects.add(aspectIndex);
    const rawCands = Array.isArray(r.candidates)
      ? r.candidates.slice(0, V2_MAX_CANDIDATES)
      : [];
    if (rawCands.length === 0) {
      throw new LlmError(
        `LLM reference ${index} has no candidates.`,
        "parse",
        true,
      );
    }
    const candidates: V2ReferenceCandidate[] = rawCands.map((rawC: unknown) => {
      const c =
        typeof rawC === "object" && rawC !== null
          ? (rawC as Record<string, unknown>)
          : {};
      const name =
        typeof c.name === "string" ? c.name.trim().replace(/\s+/g, " ") : "";
      const entityType = typeof c.entityType === "string" ? c.entityType : "";
      const analogy = typeof c.analogy === "string" ? c.analogy.trim() : "";
      if (
        name === "" ||
        name.length > 120 ||
        !(V2_REFERENCE_TYPES as readonly string[]).includes(entityType) ||
        analogy === "" ||
        analogy.length > 300
      ) {
        throw new LlmError(
          `LLM reference ${index} candidate invalid.`,
          "parse",
          true,
        );
      }
      return { name, entityType, analogy };
    });
    return { aspectId: aspects[aspectIndex].id, candidates };
  });

  return {
    brief: {
      interpretation,
      aspects,
      constraints: cleanStrings(root.constraints, 5, 200),
      contrasts: cleanStrings(root.contrasts, 5, 200),
      unrepresentable: cleanStrings(root.unrepresentable, 5, 200),
    },
    references,
  };
}

async function liveChat(
  messages: ChatMessage[],
  execution?: LlmExecutionContext,
): Promise<string> {
  execution?.signal?.throwIfAborted();
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
      return await callChatCompletions(
        GROQ_URL,
        groqKey,
        readEnv("GROQ_MODEL") ?? "openai/gpt-oss-120b",
        messages,
        "groq",
        execution,
      );
    } catch (err) {
      if (execution?.signal?.aborted) throw err;
      lastError = err;
    }
  }
  if (openRouterKey !== null) {
    execution?.signal?.throwIfAborted();
    try {
      return await callChatCompletions(
        OPENROUTER_URL,
        openRouterKey,
        readEnv("OPENROUTER_MODEL") ?? "nvidia/nemotron-3-ultra-550b-a55b:free",
        messages,
        "openrouter",
        {
          ...execution,
          extraHeaders: {
            "HTTP-Referer":
              readEnv("NEXT_PUBLIC_APP_URL") ?? "http://localhost:3000",
            "X-Title": "Whitespace",
          },
        },
      );
    } catch (err) {
      if (execution?.signal?.aborted) throw err;
      lastError = err;
    }
  }
  if (lastError instanceof LlmError) throw lastError;
  throw new LlmError("LLM request failed.", "llm", true);
}

/**
 * Propose the brief + reference candidates for a pitch. One attempt
 * plus at most one structured repair naming the failure (§6). Throws
 * `LlmError`; never returns unvalidated output.
 */
export async function proposeV2Brief(
  pitchText: string,
  workType: string,
  chat: V2ChatTransport = liveChat,
  execution?: LlmExecutionContext,
): Promise<V2BriefProposal> {
  if (typeof window !== "undefined") {
    throw new Error("proposeV2Brief is server-only.");
  }
  const pitch = pitchText;
  if (pitch.trim() === "") {
    throw new LlmError("Pitch text is empty.", "input", true);
  }
  execution?.signal?.throwIfAborted();
  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt(workType) },
    { role: "user", content: `Pitch (${workType}): ${pitch}` },
  ];
  const first = await chat(messages, execution);
  execution?.signal?.throwIfAborted();
  try {
    return toV2BriefProposal(JSON.parse(extractJson(first)), pitch);
  } catch (err) {
    execution?.signal?.throwIfAborted();
    const reason = err instanceof Error ? err.message : "invalid output";
    const retry = await chat(
      [
        ...messages,
        {
          role: "user",
          content: `Your last reply failed validation: ${reason}. Reply again with JSON ONLY matching the schema, fixing exactly that problem.`,
        },
      ],
      execution,
    );
    execution?.signal?.throwIfAborted();
    return toV2BriefProposal(JSON.parse(extractJson(retry)), pitch);
  }
}

export { LlmError } from "./llm-client.ts";
