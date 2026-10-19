/**
 * Word-bridge proposal tests. Owned by U.
 *
 * Synthetic provider responses only: no live LLM calls, no env-file
 * reads. The transport (`fetch`) is stubbed per test; keys are
 * synthetic values set in-process, never real credentials.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { scoreAllWeighted, type WeightedTag } from "../scoring/fit.ts";
import { bridgesToWeightedTags } from "../scoring/semantic.ts";
import {
  availableFromTastes,
  BRIDGE_MAX_TOKENS,
  BRIDGE_PER_LIST_TASTES,
  BRIDGE_TEMPERATURE,
  buildBridgeMessages,
  isBridgeConfigured,
  namesById,
  proposeBridges,
  toBridgeResult,
  usableBridges,
} from "./bridge.ts";
import { LlmError } from "./llm-client.ts";

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

  it("trims each audience list to 15, contenders-first order kept", () => {
    const aIds = Array.from({ length: 20 }, (_, i) => `urn:tag:a${i}`);
    const bIds = Array.from({ length: 20 }, (_, i) => `urn:tag:b${i}`);
    const out = availableFromTastes([
      { audienceId: "a", tagIds: aIds },
      { audienceId: "b", tagIds: bIds },
    ]);
    assert.equal(BRIDGE_PER_LIST_TASTES, 15);
    assert.equal(out.length, 30);
    assert.deepEqual(
      out.slice(0, 15).map((a) => a.id),
      aIds.slice(0, 15),
    );
    assert.deepEqual(
      out.slice(15).map((a) => a.id),
      bIds.slice(0, 15),
    );
    assert.ok(!out.some((a) => a.id === "urn:tag:a15"));
    assert.ok(!out.some((a) => a.id === "urn:tag:b19"));
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
    const first = await proposeBridges({ words: WORDS, available: AVAILABLE });
    const second = await proposeBridges({ words: WORDS, available: AVAILABLE });
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

describe("usableBridges", () => {
  const weighted = (qlooTagId: string, weight: number): WeightedTag => ({
    tag: { tag: qlooTagId, qlooTagId, pinned: false },
    weight,
    label: qlooTagId,
  });

  it("keeps a bridge a contender holds", () => {
    const kept = usableBridges(
      [weighted("urn:tag:a", 0.75), weighted("urn:tag:b", 0.5)],
      new Set(["urn:tag:a"]),
    );
    assert.deepEqual(
      kept.map((w) => w.tag.qlooTagId),
      ["urn:tag:a"],
    );
  });

  it("drops a weighted bridge no contender holds — it only dilutes", () => {
    const kept = usableBridges([weighted("urn:tag:b", 0.75)], new Set());
    assert.deepEqual(kept, []);
  });

  it("keeps a distance bridge nobody holds: it scores nothing", () => {
    const kept = usableBridges([weighted("urn:tag:b", 0)], new Set());
    assert.equal(kept.length, 1);
    assert.equal(kept[0]?.weight, 0);
  });
});
