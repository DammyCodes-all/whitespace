import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isLlmConfigured,
  LlmError,
  proposeProposals,
  toResult,
} from "./propose.ts";

// No keys in this env: validation and keyless paths never dial the network.
delete process.env.GROQ_API_KEY;
delete process.env.OPENROUTER_API_KEY;

function validInput() {
  return {
    similarTitles: ["Moon", "Arrival", "Dune"],
    candidateWords: ["slow", "quiet", "solitude", "space", "neon"],
    rivalProposals: [
      { id: "rival-1", name: "A", reason: "One.", titles: ["X", "Y", "Z"] },
      { id: "rival-2", name: "B", reason: "Two.", titles: ["X", "Y", "Z"] },
      { id: "rival-3", name: "C", reason: "Three.", titles: ["X", "Y", "Z"] },
    ],
  };
}

describe("toResult", () => {
  it("accepts a valid shape with trimming and dedupe", () => {
    const result = toResult({
      ...validInput(),
      similarTitles: [" Moon ", "moon", "Arrival", "Dune"],
    });
    assert.deepEqual(result.similarTitles, ["Moon", "Arrival", "Dune"]);
    assert.equal(result.rivalProposals.length, 3);
  });

  it("caps similar titles at 5 and words at 6", () => {
    const result = toResult({
      similarTitles: ["a", "b", "c", "d", "e", "f", "g"],
      candidateWords: [
        "w1",
        "w2",
        "w3",
        "w4",
        "w5",
        "w6",
        "w7",
        "w8",
        "w9",
        "w10",
        "w11",
        "w12",
      ],
      rivalProposals: validInput().rivalProposals,
    });
    assert.equal(result.similarTitles.length, 5);
    assert.equal(result.candidateWords.length, 6);
  });

  it("drops overlong strings and defaults missing rival ids", () => {
    const result = toResult({
      similarTitles: ["Moon", "Arrival", "Dune"],
      candidateWords: ["ok", "x".repeat(81), "fine", "a", "b", "c"],
      rivalProposals: [
        { name: "A", reason: "One.", titles: ["X", "Y", "Z"] },
        { name: "B", reason: "Two.", titles: ["X", "Y", "Z"] },
        { name: "C", reason: "Three.", titles: ["X", "Y", "Z"] },
      ],
    });
    assert.ok(!result.candidateWords.includes("x".repeat(81)));
    assert.deepEqual(
      result.rivalProposals.map((r) => r.id),
      ["rival-1", "rival-2", "rival-3"],
    );
  });

  it("throws LlmError on too few similar titles", () => {
    assert.throws(
      () => toResult({ ...validInput(), similarTitles: ["Only"] }),
      (err: unknown) => err instanceof LlmError,
    );
  });

  it("throws LlmError on too few candidate words", () => {
    assert.throws(
      () => toResult({ ...validInput(), candidateWords: ["one"] }),
      (err: unknown) => err instanceof LlmError,
    );
  });

  it("throws LlmError when rivals are missing or thin", () => {
    assert.throws(
      () =>
        toResult({
          ...validInput(),
          rivalProposals: validInput().rivalProposals.slice(0, 2),
        }),
      (err: unknown) => err instanceof LlmError,
    );
    assert.throws(
      () =>
        toResult({
          ...validInput(),
          rivalProposals: [
            { id: "r1", name: "A", reason: "One.", titles: ["Only"] },
            { id: "r2", name: "B", reason: "Two.", titles: ["X", "Y", "Z"] },
            { id: "r3", name: "C", reason: "Three.", titles: ["X", "Y", "Z"] },
          ],
        }),
      (err: unknown) => err instanceof LlmError,
    );
  });

  it("throws LlmError on non-object JSON", () => {
    assert.throws(
      () => toResult(null),
      (err: unknown) => err instanceof LlmError,
    );
  });
});

describe("proposeProposals without keys", () => {
  it("reports unconfigured and throws configured=false", async () => {
    assert.equal(isLlmConfigured(), false);
    await assert.rejects(
      proposeProposals({ pitchText: "A quiet film.", workType: "film" }),
      (err: unknown) => err instanceof LlmError && err.configured === false,
    );
  });

  it("rejects empty pitch text", async () => {
    await assert.rejects(
      proposeProposals({ pitchText: "   ", workType: "film" }),
      (err: unknown) => err instanceof LlmError,
    );
  });
});
