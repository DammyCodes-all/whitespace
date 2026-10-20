import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  firstParam,
  MAX_START_TITLES,
  startPitch,
  startTitles,
} from "./start-pitch.ts";

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

describe("startTitles", () => {
  it("returns the comma-joined titles an example handed over", () => {
    assert.equal(
      startTitles({
        titles: "Blade Runner 2049, The Matrix, Ghost in the Shell",
      }),
      "Blade Runner 2049, The Matrix, Ghost in the Shell",
    );
  });

  it("treats a missing or blank list as none", () => {
    assert.equal(startTitles({}), "");
    assert.equal(startTitles({ titles: "  ,  , " }), "");
  });

  it("trims rows and drops duplicates", () => {
    assert.equal(
      startTitles({ titles: " Moon , Arrival, Moon " }),
      "Moon, Arrival",
    );
  });

  it("caps the list without spending unbounded title searches", () => {
    const many = Array.from(
      { length: MAX_START_TITLES + 3 },
      (_, i) => `Title ${i}`,
    ).join(", ");
    assert.equal(
      startTitles({ titles: many }).split(", ").length,
      MAX_START_TITLES,
    );
  });

  it("takes the first value of a repeated param", () => {
    assert.equal(startTitles({ titles: ["Moon", "Arrival"] }), "Moon");
  });
});

describe("firstParam", () => {
  it("flattens an array, falls back to a string, and tolerates absence", () => {
    assert.equal(firstParam(["a", "b"]), "a");
    assert.equal(firstParam("a"), "a");
    assert.equal(firstParam(undefined), "");
  });
});
