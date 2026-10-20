import assert from "node:assert/strict";
import { test } from "node:test";
import { fitIndex, fitIndexLabel } from "./fit-index.ts";

test("fit index is out of 100 and never a percentage", () => {
  assert.equal(fitIndex(0.716), 72);
  assert.equal(fitIndexLabel(0.716), "72/100");
  assert.ok(!fitIndexLabel(0.716).includes("%"));
});
