import assert from "node:assert/strict";
import { test } from "node:test";
import { buildTargetingBrief, REACH_SLOTS, VERDICT_WORDS } from "./brief.ts";
import type { FlowResult } from "./contract.ts";

function fixture(overrides: Partial<FlowResult> = {}): FlowResult {
  return {
    pitch: "A quiet science-fiction film about a lonely worker.",
    type: "film",
    tags: [],
    audiences: [
      {
        id: "hyp",
        name: "Slow science-fiction",
        role: "named",
        score: 0.61,
        tagHits: [],
        evidenceId: "call-tastes-1",
        titles: [],
      },
    ],
    ceiling: 0.33,
    verdict: "strong",
    surprise: false,
    reach: [
      {
        audienceId: "hyp",
        audienceName: "Slow science-fiction",
        interests: [{ name: "solitude", rank: 1, evidenceId: "call-tastes-1" }],
        people: [],
        podcasts: [],
        brands: [],
        places: [],
      },
    ],
    evidence: {},
    gaps: [],
    qlooCalls: { network: 2, cached: 9, total: 11 },
    ...overrides,
  };
}

test("names the verdict word, the pitch and the call counts", () => {
  const brief = buildTargetingBrief(fixture());
  assert.match(brief, /^# Targeting brief — Strong fit/);
  assert.match(
    brief,
    /Pitch: A quiet science-fiction film about a lonely worker\./,
  );
  assert.match(brief, /Type: film/);
  assert.match(
    brief,
    /- Slow science-fiction \(named\): 0\.61 \[evidence: call-tastes-1\]/,
  );
  assert.match(brief, /Control ceiling: 0\.33/);
  assert.match(brief, /Qloo calls: 2 network, 9 cached/);
});

test("keeps the footer on every brief", () => {
  const brief = buildTargetingBrief(fixture());
  assert.ok(
    brief.endsWith(
      "Built from group-level taste data. Does not predict outcomes.",
    ),
  );
});

test("writes not measured instead of a zero for absent reach slots", () => {
  const brief = buildTargetingBrief(fixture());
  assert.match(brief, /People: not measured/);
  assert.match(brief, /Places: not measured/);
  assert.match(brief, /Interests: solitude \(#1\)/);
});

test("says the ceiling is not measured when no control was judgeable", () => {
  const brief = buildTargetingBrief(fixture({ ceiling: null }));
  assert.match(brief, /Control ceiling: not measured/);
  assert.ok(!brief.includes("Control ceiling: 0.00"));
});

test("writes no reach plan when nothing beat the ceiling", () => {
  const brief = buildTargetingBrief(fixture({ reach: null }));
  assert.match(
    brief,
    /## Reach plan\nNone: nothing beat the control ceiling\./,
  );
});

test("warns on a close call, because a re-run may read differently", () => {
  const close: FlowResult = fixture({
    ceiling: 0.6,
    audiences: [
      {
        id: "hyp",
        name: "Slow science-fiction",
        role: "named",
        score: 0.61,
        tagHits: [],
        evidenceId: null,
        titles: [],
      },
    ],
  });
  assert.match(
    buildTargetingBrief(close),
    /Close call: near the control line — a re-run may read differently\./,
  );
  assert.ok(!buildTargetingBrief(fixture()).includes("Close call"));
});

test("every reach slot has a word, so the brief never prints a raw key", () => {
  const slots = REACH_SLOTS.map((s) => s.slot);
  assert.deepEqual(slots, [
    "interests",
    "people",
    "podcasts",
    "brands",
    "places",
  ]);
  for (const verdict of ["strong", "mixed", "weak", "inconclusive"] as const) {
    assert.equal(typeof VERDICT_WORDS[verdict], "string");
  }
});
