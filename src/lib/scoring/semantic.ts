/**
 * AI word-bridge scoring weights. Owned by S.
 *
 * Pure logic, no I/O, no AI: the model only points each leftover pitch
 * word at an already-fetched taste id plus a bucket (`bridge.ts`); the
 * fixed weights below turn buckets into numbers here, so our code
 * scores and the AI never does (§7). Buckets: strong 0.75, related
 * 0.5, distant 0 — distant renders as "considered, not counted" and
 * contributes zero. At most 4 bridges per run; pinned must-haves are
 * never bridged (exact-only). Every bridged id must already sit in the
 * run's fetched tastes, so §8 grounding holds with no new Qloo call.
 * Deterministic: same input, same output (§10 #7). Server-safe: no
 * window usage.
 *
 * Self-tests live at the bottom of this file behind RUN_SELF_TESTS so
 * production imports never execute them; run them explicitly with
 * `pnpm dlx tsx --test src/lib/scoring/semantic.ts` (bare `tsx --test`
 * only discovers `*.test.ts`, so this file is NOT picked up by default
 * globs — pass its path explicitly).
 *
 * Spec ref: §6.6 (weighted mean; pinned-x2 precedent for non-unit
 * weights), §7 (our code scores), §8 (grounding).
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pathToFileURL } from "node:url";
import type { PitchTag } from "@/lib/types";
import type { AudienceTastes, WeightedTag } from "./fit.ts";
import { scoreAllWeighted } from "./fit.ts";

/**
 * True only when this file itself is the test entrypoint (e.g. `tsx
 * --test src/lib/scoring/semantic.ts`). False when imported by the app
 * (Next.js server, run-flow, bridge), so the self-tests below never
 * register or run in production.
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

/** AI buckets for one leftover word pointing at a fetched taste id. */
export type BridgeBucket = "strong" | "related" | "distant";

/** Fixed bucket weights: distant is considered but counts zero. */
export const BRIDGE_WEIGHT_MAP: Record<BridgeBucket, number> = {
  strong: 0.75,
  related: 0.5,
  distant: 0,
};

/** At most this many bridges per run (drift control, cf. expansion). */
export const MAX_BRIDGES = 4;

/** One validated bridge: leftover word -> fetched taste id + bucket. */
export interface Bridge {
  /** Original pitch word, e.g. "lonely". */
  word: string;
  /** Already-fetched Qloo tag id, e.g. "urn:tag:mood:media:solitude". */
  qlooTagId: string;
  bucket: BridgeBucket;
}

/** True for exactly "strong", "related" or "distant" (nothing else). */
export function isBridgeBucket(value: unknown): value is BridgeBucket {
  return value === "strong" || value === "related" || value === "distant";
}

function cleanWord(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (trimmed === "" || trimmed.length > 80) return null;
  return trimmed;
}

/**
 * Strictly validate an AI bridge payload. The envelope must be
 * `{bridges: [{word, qlooTagId, bucket}]}`; every entry needs a
 * non-empty word, an id from `allowedIds` (already-fetched tastes —
 * nothing invented) and a known bucket. Anything else throws and the
 * caller runs on exact matches. Duplicates collapse to the first
 * occurrence; output caps at {@link MAX_BRIDGES}. Deterministic.
 */
export function toBridges(
  data: unknown,
  allowedIds: ReadonlySet<string>,
): Bridge[] {
  if (typeof data !== "object" || data === null) {
    throw new Error("Bridge JSON must be an object.");
  }
  const list = (data as Record<string, unknown>).bridges;
  if (!Array.isArray(list)) {
    throw new Error('Bridge JSON must hold a "bridges" array.');
  }
  const seenWords = new Set<string>();
  const seenIds = new Set<string>();
  const out: Bridge[] = [];
  for (const raw of list) {
    if (typeof raw !== "object" || raw === null) {
      throw new Error("Each bridge must be an object.");
    }
    const entry = raw as Record<string, unknown>;
    const word = cleanWord(entry.word);
    const qlooTagId =
      typeof entry.qlooTagId === "string" ? entry.qlooTagId.trim() : "";
    if (word === null) {
      throw new Error("Each bridge needs a non-empty word.");
    }
    if (qlooTagId === "") {
      throw new Error(`Bridge for "${word}" needs a Qloo tag id.`);
    }
    if (!isBridgeBucket(entry.bucket)) {
      throw new Error(`Bridge for "${word}" needs a known bucket.`);
    }
    if (!allowedIds.has(qlooTagId)) {
      throw new Error(`Bridge for "${word}" points outside fetched tastes.`);
    }
    const wordKey = word.toLowerCase();
    if (seenWords.has(wordKey) || seenIds.has(qlooTagId)) continue;
    seenWords.add(wordKey);
    seenIds.add(qlooTagId);
    out.push({ word, qlooTagId, bucket: entry.bucket });
    if (out.length >= MAX_BRIDGES) break;
  }
  return out;
}

/**
 * Leftover words for the bridge call: matched dictionary tags scoring
 * zero everywhere (id in no scored taste list), non-pinned (pinned
 * must-haves stay exact-only), not already given a second chance
 * (`coveredWords`, e.g. expansion words), pitch order, capped at
 * {@link MAX_BRIDGES}. Deterministic.
 */
export function selectLeftoverWords(
  pitchTags: readonly PitchTag[],
  heldIds: ReadonlySet<string>,
  coveredWords: ReadonlySet<string> = new Set(),
  cap: number = MAX_BRIDGES,
): string[] {
  const covered = new Set([...coveredWords].map((w) => w.toLowerCase()));
  const out: string[] = [];
  for (const tag of pitchTags) {
    if (tag.pinned) continue;
    if (heldIds.has(tag.qlooTagId)) continue;
    if (covered.has(tag.tag.toLowerCase())) continue;
    out.push(tag.tag);
    if (out.length >= cap) break;
  }
  return out;
}

/** Display label: every bridge renders, distant ones included. */
export function bridgeLabel(
  word: string,
  name: string,
  bucket: BridgeBucket,
): string {
  return `${word}→${name} (AI: ${bucket})`;
}

/**
 * Turn validated bridges into weighted tags following the
 * `WeightedTag` pattern (`fit.ts`): fixed bucket weights, pinned
 * false, label `word→Tag Name (AI: bucket)`. Distant-zero entries are
 * kept so they render as considered-but-zero. Deterministic.
 */
export function bridgesToWeightedTags(
  bridges: readonly Bridge[],
  nameById: ReadonlyMap<string, string>,
): WeightedTag[] {
  return bridges.slice(0, MAX_BRIDGES).map((bridge) => ({
    tag: { tag: bridge.word, qlooTagId: bridge.qlooTagId, pinned: false },
    weight: BRIDGE_WEIGHT_MAP[bridge.bucket],
    label: bridgeLabel(
      bridge.word,
      nameById.get(bridge.qlooTagId) ?? bridge.qlooTagId,
      bridge.bucket,
    ),
  }));
}

/*
 * Self-tests (owned by S). Fixtures and synthetic tastes only: no Qloo
 * calls, no LLM calls, no env keys. Covers the contract: bucket
 * weights (distant is zero), cap at 4, pinned exclusion, malformed
 * rejection, exact-only fallback equivalence, discrimination (right
 * gap widens) and determinism. Runs only under RUN_SELF_TESTS.
 */
if (RUN_SELF_TESTS) {
  const BASE = "urn:tag:base";
  const BRIDGED = "urn:tag:bridged";

  function fill(prefix: string, count: number): string[] {
    return Array.from({ length: count }, (_, i) => `urn:tag:${prefix}${i}`);
  }

  /** Base tag at rank 6 of 10 (strength 0.5) in both audiences. */
  function rightTastes(): AudienceTastes {
    const rest = fill("r", 8);
    return {
      audienceId: "right",
      tagIds: [BRIDGED, ...rest.slice(0, 4), BASE, ...rest.slice(4)],
    };
  }

  function wrongTastes(): AudienceTastes {
    const rest = fill("w", 9);
    return {
      audienceId: "wrong",
      tagIds: [...rest.slice(0, 5), BASE, ...rest.slice(5)],
    };
  }

  function baseWtags() {
    return [
      {
        tag: { tag: "base-word", qlooTagId: BASE, pinned: false },
        weight: 1,
      },
    ];
  }

  function approx(actual: number, expected: number): void {
    assert.ok(
      Math.abs(actual - expected) < 1e-9,
      `expected ~${expected}, got ${actual}`,
    );
  }

  describe("bucket weights", () => {
    it("maps strong 0.75, related 0.5, distant 0", () => {
      assert.equal(BRIDGE_WEIGHT_MAP.strong, 0.75);
      assert.equal(BRIDGE_WEIGHT_MAP.related, 0.5);
      assert.equal(BRIDGE_WEIGHT_MAP.distant, 0);
      assert.equal(MAX_BRIDGES, 4);
    });
  });

  describe("toBridges", () => {
    const ids = new Set([BRIDGED, "urn:tag:other"]);

    it("accepts a valid envelope in order", () => {
      const out = toBridges(
        {
          bridges: [
            { word: "lonely", qlooTagId: BRIDGED, bucket: "strong" },
            { word: "quiet", qlooTagId: "urn:tag:other", bucket: "distant" },
          ],
        },
        ids,
      );
      assert.deepEqual(out, [
        { word: "lonely", qlooTagId: BRIDGED, bucket: "strong" },
        { word: "quiet", qlooTagId: "urn:tag:other", bucket: "distant" },
      ]);
    });

    it("caps at MAX_BRIDGES preserving order", () => {
      const many = Array.from({ length: 6 }, (_, i) => ({
        word: `w${i}`,
        qlooTagId: `urn:tag:m${i}`,
        bucket: "related",
      }));
      const allowed = new Set(many.map((m) => m.qlooTagId));
      const out = toBridges({ bridges: many }, allowed);
      assert.equal(out.length, 4);
      assert.deepEqual(
        out.map((b) => b.word),
        ["w0", "w1", "w2", "w3"],
      );
    });

    it("collapses duplicate words and ids to the first", () => {
      const out = toBridges(
        {
          bridges: [
            { word: "lonely", qlooTagId: BRIDGED, bucket: "strong" },
            { word: "Lonely", qlooTagId: "urn:tag:other", bucket: "related" },
            { word: "other", qlooTagId: BRIDGED, bucket: "related" },
          ],
        },
        ids,
      );
      assert.deepEqual(out, [
        { word: "lonely", qlooTagId: BRIDGED, bucket: "strong" },
      ]);
    });

    it("rejects every malformed shape", () => {
      const bad: unknown[] = [
        null,
        "bridges",
        {},
        { bridges: "nope" },
        { bridges: [{ word: "lonely", qlooTagId: BRIDGED }] },
        { bridges: [{ word: "lonely", qlooTagId: BRIDGED, bucket: "close" }] },
        { bridges: [{ word: "", qlooTagId: BRIDGED, bucket: "strong" }] },
        { bridges: [{ word: "lonely", qlooTagId: "", bucket: "strong" }] },
        {
          bridges: [
            { word: "lonely", qlooTagId: "urn:tag:invented", bucket: "strong" },
          ],
        },
        { bridges: ["lonely"] },
        { bridges: [null] },
      ];
      for (const payload of bad) {
        assert.throws(() => toBridges(payload, ids), Error);
      }
    });
  });

  describe("selectLeftoverWords", () => {
    const tags = [
      { tag: "held", qlooTagId: "urn:tag:held", pinned: false },
      { tag: "free", qlooTagId: "urn:tag:free", pinned: false },
      { tag: "must", qlooTagId: "urn:tag:must", pinned: true },
    ];

    it("returns zero-everywhere non-pinned words in pitch order", () => {
      assert.deepEqual(selectLeftoverWords(tags, new Set(["urn:tag:held"])), [
        "free",
      ]);
    });

    it("never bridges pinned must-haves", () => {
      const words = [
        { tag: "held", qlooTagId: "urn:tag:held", pinned: false },
        { tag: "must", qlooTagId: "urn:tag:must", pinned: true },
      ];
      assert.deepEqual(
        selectLeftoverWords(words, new Set(["urn:tag:held"])),
        [],
      );
    });

    it("skips words already given a second chance", () => {
      assert.deepEqual(
        selectLeftoverWords(tags, new Set(["urn:tag:held"]), new Set(["free"])),
        [],
      );
    });

    it("caps leftovers at 4", () => {
      const many = Array.from({ length: 6 }, (_, i) => ({
        tag: `w${i}`,
        qlooTagId: `urn:tag:free${i}`,
        pinned: false,
      }));
      assert.equal(selectLeftoverWords(many, new Set()).length, 4);
    });
  });

  describe("bridgesToWeightedTags", () => {
    const bridges: Bridge[] = [
      { word: "lonely", qlooTagId: BRIDGED, bucket: "strong" },
      { word: "haze", qlooTagId: "urn:tag:haze", bucket: "distant" },
    ];
    const names = new Map([[BRIDGED, "Bridged Name"]]);

    it("renders every bridge as word->Tag Name (AI: bucket)", () => {
      const out = bridgesToWeightedTags(bridges, names);
      assert.equal(out[0]?.label, "lonely→Bridged Name (AI: strong)");
      assert.equal(out[1]?.label, "haze→urn:tag:haze (AI: distant)");
      assert.equal(
        bridgeLabel("lonely", "Bridged Name", "strong"),
        "lonely→Bridged Name (AI: strong)",
      );
    });

    it("applies fixed weights with distant at zero", () => {
      const out = bridgesToWeightedTags(bridges, names);
      assert.equal(out[0]?.weight, 0.75);
      assert.equal(out[1]?.weight, 0);
      assert.equal(out[0]?.tag.pinned, false);
    });

    it("caps at MAX_BRIDGES", () => {
      const many: Bridge[] = Array.from({ length: 6 }, (_, i) => ({
        word: `w${i}`,
        qlooTagId: `urn:tag:m${i}`,
        bucket: "related" as const,
      }));
      assert.equal(bridgesToWeightedTags(many, new Map()).length, 4);
    });
  });

  describe("bridged scoring", () => {
    const names = new Map([[BRIDGED, "Bridged Name"]]);
    const strong: Bridge[] = [
      { word: "lonely", qlooTagId: BRIDGED, bucket: "strong" },
    ];

    it("widens the right gap: right rises via the high-ranked bridged tag, wrong does not", () => {
      const exact = scoreAllWeighted(
        [rightTastes(), wrongTastes()],
        baseWtags(),
      );
      approx(exact[0]?.score ?? -1, 0.5);
      approx(exact[1]?.score ?? -1, 0.5);
      const bridged = scoreAllWeighted(
        [rightTastes(), wrongTastes()],
        [...baseWtags(), ...bridgesToWeightedTags(strong, names)],
      );
      const right = bridged[0]?.score ?? -1;
      const wrong = bridged[1]?.score ?? -1;
      approx(right, (0.5 + 0.75 * 1) / 1.75);
      approx(wrong, 0.5 / 1.75);
      assert.ok(right > (exact[0]?.score ?? 0));
      assert.ok(wrong <= (exact[1]?.score ?? 1));
      assert.ok(right - wrong > 0);
      assert.ok(
        bridged[0]?.matchedTags.includes("lonely→Bridged Name (AI: strong)"),
      );
      assert.ok(
        bridged[1]?.zeroTags.includes("lonely→Bridged Name (AI: strong)"),
      );
    });

    it("renders distant-zero bridges as considered but scores identically", () => {
      const exact = scoreAllWeighted(
        [rightTastes(), wrongTastes()],
        baseWtags(),
      );
      const distant: Bridge[] = [
        { word: "lonely", qlooTagId: BRIDGED, bucket: "distant" },
      ];
      const withDistant = scoreAllWeighted(
        [rightTastes(), wrongTastes()],
        [...baseWtags(), ...bridgesToWeightedTags(distant, names)],
      );
      assert.deepEqual(
        withDistant.map((s) => s.score),
        exact.map((s) => s.score),
      );
      assert.ok(
        withDistant[0]?.matchedTags.includes(
          "lonely→Bridged Name (AI: distant)",
        ),
      );
    });

    it("falls back to exact-only scores with no bridges", () => {
      const exact = scoreAllWeighted(
        [rightTastes(), wrongTastes()],
        baseWtags(),
      );
      const fallback = scoreAllWeighted(
        [rightTastes(), wrongTastes()],
        [...baseWtags(), ...bridgesToWeightedTags([], names)],
      );
      assert.deepEqual(fallback, exact);
    });

    it("is deterministic: same input twice gives identical output", () => {
      const payload = {
        bridges: [{ word: "lonely", qlooTagId: BRIDGED, bucket: "strong" }],
      };
      const ids = new Set([BRIDGED]);
      const first = scoreAllWeighted(
        [rightTastes(), wrongTastes()],
        [
          ...baseWtags(),
          ...bridgesToWeightedTags(toBridges(payload, ids), names),
        ],
      );
      const second = scoreAllWeighted(
        [rightTastes(), wrongTastes()],
        [
          ...baseWtags(),
          ...bridgesToWeightedTags(toBridges(payload, ids), names),
        ],
      );
      assert.deepEqual(first, second);
    });
  });
}
