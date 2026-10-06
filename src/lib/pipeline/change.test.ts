import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MIN_RISE } from "../policy/change.ts";
import type { AudienceTastes } from "../scoring/fit.ts";
import type { Audience, PipelineResult, PitchTag } from "../types.ts";
import type { ProposeFn } from "./change.ts";
import { proposeChange } from "./change.ts";

// Twenty-deep taste list: covered slow-burn at rank 1, gapped solitude
// at rank 2, the rest unlabeled filler the gap finder skips.
const TASTES: AudienceTastes = {
  audienceId: "top",
  tagIds: [
    "urn:tag:mood:media:slow_burn",
    "urn:tag:theme:media:solitude",
    ...Array.from({ length: 18 }, (_, i) => `urn:filler-${i}`),
  ],
};

const PITCH_TAGS: PitchTag[] = [
  {
    tag: "slow-burn",
    qlooTagId: "urn:tag:mood:media:slow_burn",
    pinned: true,
  },
];

const TOP: Audience = {
  id: "top",
  kind: "hypothesis",
  name: "Top",
  titles: [],
  notFoundTitles: [],
};

function control(id: string, score: number) {
  return {
    audience: {
      id,
      kind: "control",
      name: id,
      titles: [],
      notFoundTitles: [],
    } as Audience,
    score: {
      audienceId: id,
      score,
      matchedTags: ["x"],
      zeroTags: [],
      noDataTags: [],
    },
  };
}

function makeResult(
  controlScore: number,
  coverage: number,
  topScore = 0.5,
): PipelineResult {
  const c = control("c1", controlScore);
  return {
    input: {
      pitchText: "pitch",
      workType: "film",
      nothingLike: [],
    },
    hypothesis: TOP,
    rivals: [],
    controls: [c.audience],
    tags: PITCH_TAGS,
    coverage,
    scores: [
      {
        audienceId: "top",
        score: topScore,
        matchedTags: ["slow-burn"],
        zeroTags: [],
        noDataTags: [],
      },
      c.score,
    ],
    verdict: {
      verdict: "Strong",
      topAudienceId: "top",
      marginTopVsSecond: 0.2,
      marginTopVsControl: 0.2,
      clearsControl: true,
      surprise: false,
    },
    grounding: { ok: true, ungroundedTitles: [], ungroundedTags: [] },
    calls: [],
    steps: [],
  };
}

const URNS: Record<string, string> = {
  solitude: "urn:tag:theme:media:solitude",
};

function resolveStub(notFound: string[] = []) {
  return async (words: string[]) => ({
    tags: words
      .filter((w) => !notFound.includes(w))
      .map((w) => ({
        tag: w,
        qlooTagId: URNS[w.toLowerCase()] ?? `urn:${w.toLowerCase()}`,
        pinned: false,
      })),
    notFoundWords: words.filter((w) => notFound.includes(w)),
    calls: [],
  });
}

const tasteStub = async () => ({ all: [TASTES] });
const proposeGap: ProposeFn = async () => "pitch with solitude inside";
const proposePlain: ProposeFn = async () => "pitch unchanged, no new words";

describe("proposeChange", () => {
  it("accepts a grounded rise that still clears control", async () => {
    const result = makeResult(0.3, 0.8);
    const changed = await proposeChange(result, "lower budget", proposeGap, {
      fetchTastes: tasteStub,
      resolveTags: resolveStub(),
    });
    assert.equal(changed.check.accepted, true);
    assert.deepEqual(changed.usedGapLabels, ["solitude"]);
    assert.ok(changed.after !== null && changed.after.score > 0.5);
    assert.equal(changed.bar.minRise, MIN_RISE);
  });

  it("withholds when the proposal adds nothing", async () => {
    const result = makeResult(0.3, 0.8, 1.0);
    const changed = await proposeChange(result, "lower budget", proposePlain, {
      fetchTastes: tasteStub,
      resolveTags: resolveStub(),
    });
    assert.equal(changed.check.accepted, false);
    assert.equal(changed.check.failedCondition, "rise");
  });

  it("withholds on ungrounded gap words", async () => {
    const result = makeResult(0.3, 0.4);
    const changed = await proposeChange(result, "lower budget", proposeGap, {
      fetchTastes: tasteStub,
      resolveTags: resolveStub(["solitude"]),
    });
    assert.equal(changed.check.accepted, false);
    assert.equal(changed.check.failedCondition, "grounding");
  });

  it("withholds when coverage falls", async () => {
    const result = makeResult(0.3, 1.0);
    const changed = await proposeChange(
      result,
      "lower budget",
      proposeGap,
      {
        fetchTastes: tasteStub,
        resolveTags: resolveStub(),
      },
      ["old-miss"],
    );
    assert.equal(changed.check.accepted, false);
    assert.equal(changed.check.failedCondition, "coverage");
  });

  it("withholds when control is lost", async () => {
    const result = makeResult(0.95, 0.8);
    const changed = await proposeChange(result, "lower budget", proposeGap, {
      fetchTastes: tasteStub,
      resolveTags: resolveStub(),
    });
    assert.equal(changed.check.accepted, false);
    assert.equal(changed.check.failedCondition, "control");
  });

  it("withholds as unrunnable without a judged top", async () => {
    const result = makeResult(0.3, 0.8);
    result.verdict = { ...result.verdict, verdict: "Inconclusive" };
    const changed = await proposeChange(result, "lower budget", proposeGap, {
      fetchTastes: tasteStub,
      resolveTags: resolveStub(),
    });
    assert.equal(changed.check.accepted, false);
    assert.equal(changed.after, null);
  });

  it("withholds when tastes are missing", async () => {
    const result = makeResult(0.3, 0.8);
    const changed = await proposeChange(result, "lower budget", proposeGap, {
      fetchTastes: async () => ({ all: [] }),
      resolveTags: resolveStub(),
    });
    assert.equal(changed.check.accepted, false);
    assert.equal(changed.after, null);
  });

  it("never hands the bar to the proposal function", async () => {
    const seen: unknown[][] = [];
    const spy: ProposeFn = async (...args) => {
      seen.push(args);
      return "pitch";
    };
    await proposeChange(makeResult(0.3, 0.8), "lower budget", spy, {
      fetchTastes: tasteStub,
      resolveTags: resolveStub(),
    });
    assert.equal(seen.length, 1);
    assert.equal(seen[0].length, 2);
    assert.equal(typeof seen[0][0], "string");
    assert.ok(Array.isArray(seen[0][1]));
  });
});
