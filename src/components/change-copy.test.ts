import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { changeReason, REAL_PEOPLE_LINE } from "./change-copy.ts";

describe("changeReason", () => {
  it("names each failed condition in plain words", () => {
    assert.match(changeReason("rise"), /improvement bar/);
    assert.match(changeReason("coverage"), /fewer of your words/);
    assert.match(changeReason("grounding"), /found in Qloo/);
    assert.match(changeReason("control"), /lost its lead/);
  });

  it("keeps the real-people disclaimer intact", () => {
    assert.match(REAL_PEOPLE_LINE, /real people/);
  });
});
