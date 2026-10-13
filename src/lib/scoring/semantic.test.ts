/**
 * Word-bridge scoring tests. Owned by S.
 *
 * Fixtures and synthetic tastes only: no Qloo calls, no LLM calls, no
 * env keys. Covers the contract: bucket weights (distant is zero),
 * cap at 4, pinned exclusion, malformed rejection, exact-only fallback
 * equivalence, discrimination (right gap widens) and determinism.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AudienceTastes } from "./fit.ts";
import { scoreAllWeighted } from "./fit.ts";
import type { Bridge } from "./semantic.ts";
import {
  BRIDGE_WEIGHT_MAP,
  bridgeLabel,
  bridgesToWeightedTags,
  MAX_BRIDGES,
  selectLeftoverWords,
  toBridges,
} from "./semantic.ts";

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
    assert.deepEqual(selectLeftoverWords(words, new Set(["urn:tag:held"])), []);
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
    const exact = scoreAllWeighted([rightTastes(), wrongTastes()], baseWtags());
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
    const exact = scoreAllWeighted([rightTastes(), wrongTastes()], baseWtags());
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
      withDistant[0]?.matchedTags.includes("lonely→Bridged Name (AI: distant)"),
    );
  });

  it("falls back to exact-only scores with no bridges", () => {
    const exact = scoreAllWeighted([rightTastes(), wrongTastes()], baseWtags());
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
