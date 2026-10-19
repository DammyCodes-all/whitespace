/**
 * Package B: LLM fit-pick for title-gift tags, one of the things the
 * LLM may do (alongside word extraction, bridge pointing and verdict
 * wording). Owned by U.
 *
 * The model never invents a scoring tag: it receives the title-gift
 * candidates (Qloo taste labels off the user's own checked titles)
 * and returns only which of THEIR ids fit the pitch. An id it was
 * not given is an output failure, never a judgment: the pass aborts
 * and the caller fails open, so a model slip can never take a chip
 * away behind the user's back. Only an omission is a judgment — a
 * candidate the model never lists is cut, and the cut-gifts row
 * offers it back. An LLM failure keeps every candidate (fail open —
 * the user still confirms each chip), so the pick is a filter,
 * never a gate.
 *
 * JSON only, validated against the candidate set. Server-only: keys
 * stay server-side.
 *
 * Spec ref: §7 (AI picks which similar-labels fit, never invents),
 * §6.5 (tie rule).
 */

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

/** Deterministic filter: same pitch + candidates give the same keep/cut. */
export const PICK_TEMPERATURE = 0;

export interface TitleTagCandidate {
  qlooId: string;
  label: string;
  sourceTitleName: string | null;
}

export interface PickTitleTagsInput {
  pitchText: string;
  candidates: TitleTagCandidate[];
}

export function systemPrompt(): string {
  return [
    "You filter taste tags against a creator's pitch. You invent nothing: you only choose among the given tag ids.",
    "Reply with JSON ONLY, no markdown, no prose, matching this shape exactly:",
    '{"kept":["id1","id2"]}',
    "Rules: judge by feel and meaning, never by word overlap with the pitch. Keep a tag id if it names something the pitch is about OR something close in theme, setting, situation or mood: 'transformation' fits a dragonfly-DNA-injection pitch even though the pitch never says the word. Prefer keeping a near-miss over cutting it — the human confirms every chip after you. Drop only tags the pitch neither earns nor resembles, and anything the pitch contradicts. When in doubt, keep. Copy ids exactly as given; list no id that was not given.",
    "Examples for a pitch like: a retired coastguard in a grey Scottish town forges ferry tickets, quiet and windswept, about duty and guilt. Keep `psychological drama` — guilt and a slow burn share its mood even though the pitch never says drama. Cut `crime documentary` — the title's fans may watch them, but the pitch is fiction, not documentary. Cut `dark comedy` — the pitch contradicts it.",
  ].join("\n");
}

/**
 * Validated kept-ids: subset of the candidate set, deduped, order
 * preserved. A valid empty list is respected (the model judged
 * nothing fitting). An id OUTSIDE the candidate set is an output
 * failure, not a judgment: it throws `LlmError` with the exact intent
 * as it left the model, so the caller's fail-open path restores
 * everything the model listed — a typo can never silently subtract a
 * chip. Unparseable output throws `LlmError` for the same reason.
 * Pure, no I/O — exported for unit tests.
 */
export function toPickResult(data: unknown, candidateIds: string[]): string[] {
  if (typeof data !== "object" || data === null) {
    throw new LlmError("LLM returned non-object JSON.", "parse", true);
  }
  const raw = (data as Record<string, unknown>).kept;
  if (!Array.isArray(raw)) {
    throw new LlmError("LLM returned no kept array.", "parse", true);
  }
  const allowed = new Set(candidateIds);
  const seen = new Set<string>();
  const kept: string[] = [];
  for (const value of raw) {
    if (typeof value !== "string") continue;
    const id = value.trim();
    if (id === "" || seen.has(id)) continue;
    seen.add(id);
    if (!allowed.has(id)) {
      // An un-offered id is an output failure, not a judgment: abort
      // so the route's fail-open path restores everything the model
      // listed. A dropped id is the judgment; a typo'd id is a slip.
      throw new LlmError(
        `LLM kept an id it was not offered: "${id}".`,
        "parse",
        true,
      );
    }
    kept.push(id);
  }
  return kept;
}

/**
 * Ask the model which candidate gift tags fit the pitch. Tries Groq
 * first, then OpenRouter. Throws `LlmError`; never returns
 * unvalidated output.
 */
export async function pickTitleTags(
  input: PickTitleTagsInput,
): Promise<string[]> {
  if (typeof window !== "undefined") {
    throw new Error("pickTitleTags is server-only.");
  }
  const pitchText = input.pitchText.trim().slice(0, 4000);
  if (pitchText === "") {
    throw new LlmError("Pitch text is empty.", "input", true);
  }
  const candidates = input.candidates.filter(
    (c) =>
      typeof c.qlooId === "string" &&
      c.qlooId.trim() !== "" &&
      typeof c.label === "string" &&
      c.label.trim() !== "",
  );
  if (candidates.length === 0) return [];
  const candidateIds = candidates.map((c) => c.qlooId);
  const listing = candidates
    .map(
      (c) =>
        `${c.qlooId}: ${c.label.trim()}` +
        (c.sourceTitleName !== null ? ` (from ${c.sourceTitleName})` : ""),
    )
    .join("\n");
  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt() },
    { role: "user", content: `Pitch: ${pitchText}\nTags:\n${listing}` },
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
    if (attempt.key === null) {
      console.info(`[titles/pick] ${attempt.provider} skipped: no key`);
      continue;
    }
    const attemptStarted = Date.now();
    try {
      const content = await callChatCompletions(
        attempt.url,
        attempt.key,
        attempt.model,
        messages,
        attempt.provider,
        {
          temperature: PICK_TEMPERATURE,
          ...("options" in attempt ? attempt.options : {}),
        },
      );
      const keptIds = toPickResult(
        JSON.parse(extractJson(content)),
        candidateIds,
      );
      console.info(
        `[titles/pick] ${attempt.provider} (${attempt.model}) ok in ${
          Date.now() - attemptStarted
        }ms: kept ${keptIds.length}/${candidateIds.length}`,
      );
      return keptIds;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(
        `[titles/pick] ${attempt.provider} (${attempt.model}) failed in ${
          Date.now() - attemptStarted
        }ms: ${message}`,
      );
      lastError = err;
    }
  }
  if (lastError instanceof LlmError) throw lastError;
  throw new LlmError("LLM request failed.", "llm", true);
}
