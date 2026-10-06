import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { demoPipelineInput, runPipeline } from "./run.ts";

// No key in this env: force the mock path so the suite never dials Qloo.
delete process.env.QLOO_API_KEY;

describe("runPipeline", () => {
  it("returns a complete PipelineResult on the mock path", async () => {
    const result = await runPipeline(demoPipelineInput, { controlCount: 2 });
    assert.equal(result.hypothesis.id, "hyp");
    assert.ok(Array.isArray(result.rivals));
    assert.ok(result.controls.length <= 2);
    assert.equal(typeof result.coverage, "number");
    assert.ok(result.scores.length > 0);
    assert.ok(result.verdict);
    assert.ok(result.grounding);
    assert.ok(result.calls.length > 0);
    assert.ok(result.steps.length >= 6);
    assert.ok(result.steps.every((s) => s.status === "done"));
    assert.equal(result.input.pitchText, demoPipelineInput.pitchText);
  });

  it("mock path is Inconclusive with grounding ok", async () => {
    const result = await runPipeline(demoPipelineInput, { controlCount: 2 });
    assert.equal(result.coverage, 0);
    assert.equal(result.verdict.verdict, "Inconclusive");
    assert.equal(result.grounding.ok, true);
  });

  it("same input gives the same verdict and scores", async () => {
    const a = await runPipeline(demoPipelineInput, { controlCount: 2 });
    const b = await runPipeline(demoPipelineInput, { controlCount: 2 });
    assert.deepEqual(a.verdict, b.verdict);
    assert.deepEqual(a.scores, b.scores);
  });

  it("empty similar titles never throws", async () => {
    const result = await runPipeline(
      { ...demoPipelineInput, similarTitles: [] },
      { controlCount: 2 },
    );
    assert.equal(result.hypothesis.titles.length, 0);
    assert.equal(result.verdict.verdict, "Inconclusive");
    assert.equal(result.grounding.ok, true);
  });
});
