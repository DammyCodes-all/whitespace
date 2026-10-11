import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MIN_MATCHED_TAGS } from "../config.ts";
import { runFlowPitch } from "./run-flow.ts";

// No key in this env: the mock path. Taste fetches fail, so the run is
// honestly Inconclusive — the flow's gates still run first.
delete process.env.QLOO_API_KEY;

const tags = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    label: `word${i}`,
    qlooId: `urn:tag:w${i}`,
    status: "matched" as const,
  }));

describe("runFlowPitch", () => {
  const pitch = "A quiet science-fiction film about a lonely worker.";
  const base = {
    pitchText: pitch,
    workType: "film" as const,
    nothingLike: [],
    similarTitles: ["Moon", "Arrival", "Dune"],
  };

  it("stops as Inconclusive below the matched-tag gate, with no scoring steps", async () => {
    const out = await runFlowPitch({
      ...base,
      tags: [
        ...tags(MIN_MATCHED_TAGS - 1),
        { label: "cozy", status: "not_found" },
      ],
    });
    assert.equal(out.stopped, true);
    assert.equal(out.result.verdict, "inconclusive");
    assert.deepEqual(
      out.steps.map((s) => s.id),
      ["tags", "verdict"],
    );
  });

  it("runs the scored path and reports matched tags plus not-found words", async () => {
    const out = await runFlowPitch({
      ...base,
      tags: [...tags(MIN_MATCHED_TAGS), { label: "cozy", status: "not_found" }],
    });
    assert.equal(out.stopped, false);
    const tagChips = out.result.tags;
    assert.equal(tagChips.length, MIN_MATCHED_TAGS + 1);
    assert.equal(
      tagChips.filter((t) => t.status === "matched").length,
      MIN_MATCHED_TAGS,
    );
    // Mock path: every audience is unjudgeable, so nothing is a number
    // and the ceiling is null rather than 0.
    assert.ok(out.result.audiences.every((a) => a.score === null));
    assert.equal(out.result.ceiling, null);
    assert.equal(out.result.reach, null);
  });

  it("reports Qloo call usage from the run", async () => {
    const out = await runFlowPitch({
      ...base,
      tags: tags(MIN_MATCHED_TAGS),
    });
    assert.equal(typeof out.result.qlooCalls.total, "number");
    assert.ok(out.result.qlooCalls.total >= 0);
  });

  it("scope gate refuses a tool pitch with no Qloo calls", async () => {
    const out = await runFlowPitch({
      pitchText:
        "I want to build a telegram bot that tracks workouts and sends reminders.",
      workType: "film",
      nothingLike: [],
      similarTitles: [],
      tags: tags(MIN_MATCHED_TAGS),
    });
    assert.equal(out.stopped, true);
    assert.equal(out.result.verdict, "inconclusive");
    assert.equal(out.steps[0]?.id, "scope");
    assert.equal(out.result.qlooCalls.total, 0);
  });

  it("stops before controls when there is nothing to judge", async () => {
    // No similar titles plus mock-path discovery (results: []) means no
    // contenders: the run must stop before the control load, naming the
    // cause instead of burning ~90 calls on an empty verdict.
    const out = await runFlowPitch({
      ...base,
      similarTitles: [],
      tags: tags(MIN_MATCHED_TAGS),
    });
    assert.equal(out.stopped, true);
    assert.equal(out.result.verdict, "inconclusive");
    assert.deepEqual(
      out.steps.map((s) => s.id),
      ["rivals", "verdict"],
    );
    assert.match(out.steps[1]?.detail ?? "", /nothing to judge/);
  });
});
