import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { EXAMPLE_PITCHES, exampleById, exampleRunHref } from "./examples.ts";

describe("worked examples", () => {
  it("ships exactly two examples with unique ids", () => {
    assert.equal(EXAMPLE_PITCHES.length, 2);
    assert.equal(
      new Set(EXAMPLE_PITCHES.map((e) => e.id)).size,
      EXAMPLE_PITCHES.length,
    );
  });

  it("gives each example a pitch and at least three comparable titles", () => {
    for (const example of EXAMPLE_PITCHES) {
      assert.ok(example.pitch.trim().length > 80);
      assert.ok(example.similarTitles.length >= 3);
      for (const title of example.similarTitles) {
        assert.ok(title.trim() !== "");
      }
    }
  });

  it("looks each example up by id", () => {
    for (const example of EXAMPLE_PITCHES) {
      assert.equal(exampleById(example.id), example);
    }
  });

  it("keeps the Extraction demo and its A comps", () => {
    const demo = EXAMPLE_PITCHES.find((e) => e.id === "extraction-demo");
    assert.ok(demo !== undefined);
    assert.deepEqual(demo.similarTitles, [
      "The Raid: Redemption",
      "Man on Fire",
      "Sicario",
    ]);
    assert.match(demo.outcome, /action/i);
    assert.match(demo.pitch, /Dhaka|mercenary/i);
  });

  it("keeps the documented zero-rival case and its comps", () => {
    const replan = EXAMPLE_PITCHES.find((e) => e.id === "mystery-replan");
    assert.ok(replan !== undefined);
    assert.deepEqual(replan.similarTitles, [
      "Se7en",
      "Gone Girl",
      "Knives Out",
    ]);
    assert.match(replan.outcome, /re-plan/i);
    assert.match(replan.pitch, /mystery noir/i);
  });
});

describe("exampleRunHref", () => {
  it("carries both the pitch and the comma-joined titles", () => {
    const example = EXAMPLE_PITCHES[0];
    assert.ok(example !== undefined);
    const href = exampleRunHref("/run", example);
    const url = new URL(href, "https://example.test");
    assert.equal(url.pathname, "/run");
    assert.equal(url.searchParams.get("pitch"), example.pitch);
    assert.equal(
      url.searchParams.get("titles"),
      example.similarTitles.join(", "),
    );
  });
});
