import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cleanQueries, foldPlural, normalizeKey } from "./resolve-shared.ts";

describe("foldPlural", () => {
  it("folds a plural to its singular", () => {
    assert.equal(foldPlural("vampires"), "vampire");
    assert.equal(foldPlural("ghost"), "ghost");
    assert.equal(foldPlural("killers"), "killer");
    assert.equal(foldPlural("secrets"), "secret");
  });

  it("keeps words whose last letter only looks plural", () => {
    assert.equal(foldPlural("madness"), "madness");
    assert.equal(foldPlural("census"), "census");
    assert.equal(foldPlural("analysis"), "analysis");
  });

  it("leaves short words alone", () => {
    assert.equal(foldPlural("gas"), "gas");
    assert.equal(foldPlural("is"), "is");
  });

  it("is symmetric: the query and the Qloo name fold the same way", () => {
    assert.equal(normalizeKey("Vampires"), normalizeKey("vampire"));
    assert.equal(normalizeKey("Slow-Burn"), normalizeKey("slow burn"));
    assert.equal(normalizeKey("Ghosts"), normalizeKey("ghosts"));
  });
});

describe("cleanQueries", () => {
  it("dedupes singular and plural into one query", () => {
    assert.deepEqual(cleanQueries(["vampire", "Vampires", "ghost"], 20), [
      "vampire",
      "ghost",
    ]);
  });

  it("drops empties and caps", () => {
    assert.deepEqual(cleanQueries([" ", "", "a", "b", "c"], 2), ["a", "b"]);
  });
});
