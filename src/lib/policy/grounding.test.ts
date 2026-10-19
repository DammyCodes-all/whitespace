import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { checkGrounding } from "./grounding.ts";

describe("checkGrounding", () => {
  it("passes when every output id came from the run", () => {
    const out = checkGrounding(
      ["urn:title:moon"],
      ["urn:tag:solitude"],
      ["urn:title:moon", "urn:title:arrival"],
      ["urn:tag:solitude", "urn:tag:grief"],
    );
    assert.equal(out.ok, true);
    assert.deepEqual(out.ungroundedTitles, []);
    assert.deepEqual(out.ungroundedTags, []);
  });

  it("flags a fabricated title id, never a soft pass", () => {
    const out = checkGrounding(
      ["urn:title:moon", "urn:title:invented"],
      [],
      ["urn:title:moon"],
      ["urn:tag:solitude"],
    );
    assert.equal(out.ok, false);
    assert.deepEqual(out.ungroundedTitles, ["urn:title:invented"]);
    assert.deepEqual(out.ungroundedTags, []);
  });

  it("flags a fabricated tag id", () => {
    const out = checkGrounding(
      [],
      ["urn:tag:solitude", "urn:tag:invented"],
      [],
      ["urn:tag:solitude"],
    );
    assert.equal(out.ok, false);
    assert.deepEqual(out.ungroundedTags, ["urn:tag:invented"]);
  });

  it("treats no output as vacuously grounded", () => {
    const out = checkGrounding([], [], [], []);
    assert.equal(out.ok, true);
  });
});
