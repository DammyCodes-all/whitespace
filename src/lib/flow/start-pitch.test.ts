import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { firstParam, startPitch } from "./start-pitch.ts";

describe("startPitch", () => {
  it("returns the pitch when one is present", () => {
    assert.equal(startPitch({ pitch: "a heist film" }), "a heist film");
  });

  it("treats a missing, empty or whitespace-only pitch as none", () => {
    assert.equal(startPitch({}), "");
    assert.equal(startPitch({ pitch: "" }), "");
    assert.equal(startPitch({ pitch: "   " }), "");
  });

  it("takes the first value of a repeated param", () => {
    assert.equal(startPitch({ pitch: ["first", "second"] }), "first");
  });

  it("trims and caps at 2000 characters", () => {
    assert.equal(startPitch({ pitch: "  padded  " }), "padded");
    assert.equal(startPitch({ pitch: "x".repeat(2500) }).length, 2000);
  });
});

describe("firstParam", () => {
  it("flattens an array, falls back to a string, and tolerates absence", () => {
    assert.equal(firstParam(["a", "b"]), "a");
    assert.equal(firstParam("a"), "a");
    assert.equal(firstParam(undefined), "");
  });
});
