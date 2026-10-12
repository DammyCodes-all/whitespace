/**
 * The adapter's honesty guard, as the brief requires: a test that no
 * placeholder 0 reaches a bar or a reach list.
 *
 * A placeholder 0 is an audience we could not judge (short or failed
 * taste list). It must never render as a zero-fit bar or appear in a
 * reach plan, because §10 #4 forbids no-data reading as a low score.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  barRows,
  type FlowAudienceScore,
  type FlowResult,
  isPlaceholderScore,
  reachableScores,
} from "./contract.ts";

function rowsFrom(scores: FlowAudienceScore[]): FlowResult {
  return {
    pitch: "p",
    type: "film",
    tags: [],
    audiences: scores,
    ceiling: null,
    verdict: "strong",
    surprise: false,
    reach: [],
    evidence: {},
    qlooCalls: { network: 0, cached: 0, total: 0 },
  };
}

describe("no placeholder 0 reaches a bar or reach list", () => {
  it("barRows drops unjudgeable audiences and keeps measured zeros", () => {
    const result = rowsFrom([
      {
        id: "a",
        name: "Judgeable",
        role: "named",
        score: 0,
        tagHits: [],
        evidenceId: null,
      },
      {
        id: "b",
        name: "Not judgeable",
        role: "rival",
        score: null,
        tagHits: [],
        evidenceId: null,
      },
    ]);
    const rows = barRows(result);
    assert.deepEqual(
      rows.map((r) => r.id),
      ["a"],
    );
    // A measured zero is honest data: it stays and is not a placeholder.
    assert.equal(rows[0]?.score, 0);
    // The unjudgeable audience never survived to a bar at all: that is
    // the guard, visible upstream as a null.
    assert.equal(result.audiences[1]?.score, null);
    assert.equal(isPlaceholderScore(result.audiences[1]), true);
    assert.equal(isPlaceholderScore(result.audiences[0]), false);
  });

  it("reachableScores never contains a null", () => {
    const result = rowsFrom([
      {
        id: "a",
        name: "A",
        role: "control",
        score: null,
        tagHits: [],
        evidenceId: null,
      },
      {
        id: "b",
        name: "B",
        role: "control",
        score: 0.42,
        tagHits: ["x"],
        evidenceId: null,
      },
    ]);
    for (const row of reachableScores(result)) {
      assert.notEqual(row.score, null);
    }
    assert.equal(reachableScores(result).length, 1);
  });
});
