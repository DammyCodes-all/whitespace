import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { demoPipelineInput } from "../pipeline/run.ts";
import { parseRunInput } from "./parse-run-input.ts";

function encode(input: unknown): string {
  // Simulates what Next hands the page: searchParams values arrive
  // percent-decoded, so the parser sees plain JSON.
  return JSON.stringify(input);
}

describe("parseRunInput", () => {
  it("falls back to demo for missing, empty, or broken input", () => {
    assert.deepEqual(parseRunInput(undefined), demoPipelineInput);
    assert.deepEqual(parseRunInput(""), demoPipelineInput);
    assert.deepEqual(parseRunInput(["x"]), demoPipelineInput);
    assert.deepEqual(
      parseRunInput("not-json{{{").pitchText,
      demoPipelineInput.pitchText,
    );
  });

  it("round-trips a full form input", () => {
    const input = {
      pitchText: "A quiet film about a lighthouse keeper.",
      workType: "film",
      nothingLike: ["Fast franchise action"],
      similarTitles: ["Moon", "Arrival"],
      candidateWords: ["quiet", "solitude"],
      pinnedWords: ["solitude"],
      rivalProposals: [
        { id: "r1", name: "R", reason: "Why.", titles: ["A", "B", "C"] },
      ],
    };
    const parsed = parseRunInput(encode(input));
    assert.equal(parsed.pitchText, input.pitchText);
    assert.deepEqual(parsed.pinnedWords, ["solitude"]);
    assert.equal(parsed.rivalProposals.length, 1);
  });

  it("preserves pitches containing % without double-decoding", () => {
    const pitchText = "A 100% improvised lo-fi set, 50% off script.";
    const parsed = parseRunInput(
      encode({
        pitchText,
        workType: "music",
        nothingLike: [],
        similarTitles: ["X", "Y", "Z"],
        candidateWords: ["a", "b", "c", "d", "e"],
        pinnedWords: [],
        rivalProposals: [],
      }),
    );
    assert.equal(parsed.pitchText, pitchText);
  });

  it("rejects still-encoded links instead of corrupting them", () => {
    const encoded = encodeURIComponent(
      JSON.stringify({ pitchText: "A quiet film." }),
    );
    assert.equal(parseRunInput(encoded).pitchText, demoPipelineInput.pitchText);
  });

  it("falls back per-field and enforces caps", () => {
    const parsed = parseRunInput(
      encode({
        pitchText: "   ",
        workType: "opera",
        nothingLike: ["a", "b", "c", "d", "e", "f"],
        similarTitles: Array.from({ length: 12 }, (_, i) => `T${i}`),
        candidateWords: Array.from({ length: 25 }, (_, i) => `w${i}`),
        pinnedWords: "not-an-array",
        rivalProposals: Array.from({ length: 7 }, (_, i) => ({
          id: `r${i}`,
          name: `R${i}`,
          reason: "",
          titles: ["a", "b", "c", "d", "e", "f"],
        })),
      }),
    );
    assert.equal(parsed.pitchText, demoPipelineInput.pitchText);
    assert.equal(parsed.workType, demoPipelineInput.workType);
    assert.equal(parsed.nothingLike.length, 5);
    assert.equal(parsed.similarTitles.length, 10);
    assert.equal(parsed.candidateWords.length, 20);
    assert.deepEqual(parsed.pinnedWords, []);
    assert.equal(parsed.rivalProposals.length, 5);
    assert.equal(parsed.rivalProposals[0].titles.length, 5);
  });
});
