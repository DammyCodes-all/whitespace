/**
 * parseSimilarTitles: the editor, the pre-check, and the run agree on
 * what was entered. Comma-separated in, trimmed non-empty titles out.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseSimilarTitles } from "./similar-titles.ts";

describe("parseSimilarTitles", () => {
  it("splits on commas and trims each title", () => {
    assert.deepEqual(parseSimilarTitles("Moon, Arrival ,Dune"), [
      "Moon",
      "Arrival",
      "Dune",
    ]);
  });

  it("drops empty entries from stray commas and blanks", () => {
    assert.deepEqual(parseSimilarTitles("Moon,, , Arrival,"), [
      "Moon",
      "Arrival",
    ]);
    assert.deepEqual(parseSimilarTitles("   "), []);
    assert.deepEqual(parseSimilarTitles(""), []);
  });

  it("keeps a single title without commas intact", () => {
    assert.deepEqual(parseSimilarTitles("  Moon  "), ["Moon"]);
  });
});
