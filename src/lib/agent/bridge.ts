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
 * Self-tests live at the bottom of this file behind RUN_SELF_TESTS so
 * production imports never execute them (in particular the synthetic
 * test keys stay inside the guard); run them explicitly with
 * `pnpm dlx tsx --test src/lib/agent/bridge.ts` (bare `tsx --test`
 * only discovers `*.test.ts`, so this file is NOT picked up by default
 * globs — pass its path explicitly).
 *
 * Spec ref: §7 (AI points, our code scores), §8 (grounding), §11
 * (caps guard quota).
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pathToFileURL } from "node:url";
import type { AudienceTastes } from "../scoring/fit.ts";
import { scoreAllWeighted } from "../scoring/fit.ts";
import {
  type Bridge,
  bridgesToWeightedTags,
  MAX_BRIDGES,
  toBridges,
} from "../scoring/semantic.ts";
import {
  type ChatMessage,
  callChatCompletions,
  extractJson,
  GROQ_URL,
  LlmError,
  OPENROUTER_URL,
  readEnv,
} from "./llm-client.ts";

/**
 * True only when this file itself is the test entrypoint (e.g. `tsx
 * --test src/lib/agent/bridge.ts`). False when imported by the app
 * (run-flow, API routes), so the self-tests below — including their
 * synthetic keys and stubbed fetch — never run in production.
 */
const RUN_SELF_TESTS: boolean = (() => {
  const entry = process.argv[1];
  if (entry === undefined) return false;
  try {
    return import.meta.url === pathToFileURL(entry).href;
  } catch {
    return false;
  }
})();

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
/** Small JSON out: at most 4 bridges. */
export const BRIDGE_MAX_TOKENS = 500;
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
 * first). Names fall back to the id when the parallel `tagNames` are
 * absent or misaligned. Pure, no I/O — exported for unit tests.
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
    for (let index = 0; index < taste.tagIds.length; index += 1) {
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
          temperature: BRIDGE_TEMPERATURE,
          maxTokens: BRIDGE_MAX_TOKENS,
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

/*
 * Self-tests (owned by U). Synthetic provider responses only: no live
 * LLM calls, no env-file reads. The transport (`fetch`) is stubbed per
 * test; keys are synthetic values set in-process, never real
 * credentials. Runs only under RUN_SELF_TESTS.
 */
if (RUN_SELF_TESTS) {
  // Synthetic key only: the transport below is stubbed, so no request
  // ever leaves the process. Never a real credential.
  process.env.GROQ_API_KEY = "synthetic-test-key";
  delete process.env.OPENROUTER_API_KEY;

  const AVAILABLE = [
    { id: "urn:tag:a", name: "Alpha" },
    { id: "urn:tag:b", name: "Beta" },
  ];
  const IDS = new Set(AVAILABLE.map((a) => a.id));
  const WORDS = ["lonely", "quiet"];

  function okResponse(payload: unknown): Response {
    return Response.json({
      choices: [{ message: { content: JSON.stringify(payload) } }],
    });
  }

  describe("toBridgeResult", () => {
    it("accepts buckets-only output in order", () => {
      const out = toBridgeResult(
        {
          bridges: [
            { word: "lonely", qlooTagId: "urn:tag:a", bucket: "strong" },
            { word: "quiet", qlooTagId: "urn:tag:b", bucket: "distant" },
          ],
        },
        IDS,
        WORDS,
      );
      assert.deepEqual(out, [
        { word: "lonely", qlooTagId: "urn:tag:a", bucket: "strong" },
        { word: "quiet", qlooTagId: "urn:tag:b", bucket: "distant" },
      ]);
    });

    it("normalizes word case to the requested spelling and caps at 4", () => {
      const many = Array.from({ length: 6 }, (_, i) => ({
        word: `W${i}`,
        qlooTagId: `urn:tag:m${i}`,
        bucket: "related",
      }));
      const out = toBridgeResult(
        { bridges: many },
        new Set(many.map((m) => m.qlooTagId)),
        many.map((m) => m.word.toLowerCase()),
      );
      assert.equal(out.length, 4);
      assert.deepEqual(
        out.map((b) => b.word),
        ["w0", "w1", "w2", "w3"],
      );
    });

    it("throws LlmError on any other shape", () => {
      const bad: unknown[] = [
        null,
        {},
        { bridges: "nope" },
        [{ word: "lonely", qlooTagId: "urn:tag:a", bucket: "strong" }],
        { bridges: [{ word: "lonely", qlooTagId: "urn:tag:a" }] },
        {
          bridges: [{ word: "lonely", qlooTagId: "urn:tag:a", bucket: "near" }],
        },
        {
          bridges: [
            { word: "lonely", qlooTagId: "urn:tag:zzz", bucket: "strong" },
          ],
        },
        {
          bridges: [
            { word: "invented", qlooTagId: "urn:tag:a", bucket: "strong" },
          ],
        },
        { bridges: [{ word: "", qlooTagId: "urn:tag:a", bucket: "strong" }] },
      ];
      for (const payload of bad) {
        assert.throws(
          () => toBridgeResult(payload, IDS, WORDS),
          (err: unknown) => err instanceof LlmError,
        );
      }
    });

    it("accepts an empty bridge list", () => {
      assert.deepEqual(toBridgeResult({ bridges: [] }, IDS, WORDS), []);
    });
  });

  describe("availableFromTastes", () => {
    it("dedupes tastes keeping first order and names", () => {
      const out = availableFromTastes([
        {
          audienceId: "a",
          tagIds: ["urn:tag:a", "urn:tag:b"],
          tagNames: ["Alpha", "Beta"],
        },
        {
          audienceId: "b",
          tagIds: ["urn:tag:b", "urn:tag:c"],
          tagNames: ["Other Beta", "Gamma"],
        },
      ]);
      assert.deepEqual(out, [
        { id: "urn:tag:a", name: "Alpha" },
        { id: "urn:tag:b", name: "Beta" },
        { id: "urn:tag:c", name: "Gamma" },
      ]);
      assert.deepEqual(
        [...namesById(out).entries()],
        [
          ["urn:tag:a", "Alpha"],
          ["urn:tag:b", "Beta"],
          ["urn:tag:c", "Gamma"],
        ],
      );
    });

    it("falls back to the id without names and caps the list", () => {
      const ids = Array.from({ length: 10 }, (_, i) => `urn:tag:${i}`);
      const out = availableFromTastes([{ audienceId: "a", tagIds: ids }], 4);
      assert.equal(out.length, 4);
      assert.equal(out[0]?.name, "urn:tag:0");
    });
  });

  describe("buildBridgeMessages", () => {
    it("lists the words and fetched tastes as JSON-only work", () => {
      const messages = buildBridgeMessages(WORDS, AVAILABLE);
      const text = messages.map((m) => m.content).join("\n");
      assert.match(text, /JSON ONLY/);
      assert.match(text, /lonely/);
      assert.match(text, /urn:tag:a/);
    });
  });

  describe("proposeBridges with a stubbed transport", () => {
    it("returns validated bridges with low temperature and capped tokens", async (t) => {
      let seenBody: Record<string, unknown> = {};
      t.mock.method(
        globalThis,
        "fetch",
        async (_url: unknown, init: RequestInit) => {
          seenBody = JSON.parse(String(init.body)) as Record<string, unknown>;
          return okResponse({
            bridges: [
              { word: "lonely", qlooTagId: "urn:tag:a", bucket: "strong" },
            ],
          });
        },
      );
      const out = await proposeBridges({ words: WORDS, available: AVAILABLE });
      assert.deepEqual(out, [
        { word: "lonely", qlooTagId: "urn:tag:a", bucket: "strong" },
      ]);
      assert.equal(seenBody.temperature, BRIDGE_TEMPERATURE);
      assert.equal(seenBody.max_tokens, BRIDGE_MAX_TOKENS);
    });

    it("sends no request for empty words", async (t) => {
      const fetch = t.mock.method(globalThis, "fetch", async () =>
        okResponse({ bridges: [] }),
      );
      assert.deepEqual(
        await proposeBridges({ words: [], available: AVAILABLE }),
        [],
      );
      assert.equal(fetch.mock.callCount(), 0);
    });

    it("throws LlmError when the transport is down, and exact-only scoring stands in", async (t) => {
      t.mock.method(globalThis, "fetch", async () => {
        throw new Error("Synthetic network failure.");
      });
      await assert.rejects(
        proposeBridges({ words: WORDS, available: AVAILABLE }),
        (err: unknown) => err instanceof LlmError,
      );
      const tastes = [
        {
          audienceId: "a",
          tagIds: [
            "urn:tag:a",
            "urn:tag:f0",
            "urn:tag:x",
            ...Array.from({ length: 7 }, (_, i) => `urn:tag:a${i}`),
          ],
        },
        {
          audienceId: "b",
          tagIds: [
            "urn:tag:g0",
            "urn:tag:g1",
            "urn:tag:x",
            ...Array.from({ length: 7 }, (_, i) => `urn:tag:b${i}`),
          ],
        },
      ];
      const exact = scoreAllWeighted(tastes, [
        { tag: { tag: "x", qlooTagId: "urn:tag:x", pinned: false }, weight: 1 },
      ]);
      const fallback = scoreAllWeighted(tastes, [
        { tag: { tag: "x", qlooTagId: "urn:tag:x", pinned: false }, weight: 1 },
        ...bridgesToWeightedTags([], new Map()),
      ]);
      assert.deepEqual(fallback, exact);
    });

    it("throws LlmError on malformed model output", async (t) => {
      t.mock.method(globalThis, "fetch", async () =>
        Response.json({
          choices: [{ message: { content: "not json at all {{{" } }],
        }),
      );
      await assert.rejects(
        proposeBridges({ words: WORDS, available: AVAILABLE }),
        (err: unknown) => err instanceof LlmError,
      );
    });

    it("is deterministic on the same stubbed payload", async (t) => {
      const payload = {
        bridges: [{ word: "quiet", qlooTagId: "urn:tag:b", bucket: "related" }],
      };
      t.mock.method(globalThis, "fetch", async () => okResponse(payload));
      const first = await proposeBridges({
        words: WORDS,
        available: AVAILABLE,
      });
      const second = await proposeBridges({
        words: WORDS,
        available: AVAILABLE,
      });
      assert.deepEqual(first, second);
    });

    it("reports configured with the synthetic key and unconfigured without", async () => {
      assert.equal(isBridgeConfigured(), true);
      const saved = process.env.GROQ_API_KEY;
      delete process.env.GROQ_API_KEY;
      try {
        assert.equal(isBridgeConfigured(), false);
        await assert.rejects(
          proposeBridges({ words: WORDS, available: AVAILABLE }),
          (err: unknown) => err instanceof LlmError && err.configured === false,
        );
      } finally {
        if (saved !== undefined) process.env.GROQ_API_KEY = saved;
      }
    });
  });
}
