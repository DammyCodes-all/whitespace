import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ACCEPTED_TITLE,
  changePct,
  changeReason,
  changeScoreLine,
  gapLine,
  REAL_PEOPLE_LINE,
  WITHHELD_FALLBACK,
} from "./change-copy.ts";

describe("changeReason", () => {
  it("names each failed condition in plain words", () => {
    assert.match(changeReason("rise"), /improvement bar/);
    assert.match(changeReason("separation"), /lifted the field more/);
    assert.match(changeReason("coverage"), /fewer of your words/);
    assert.match(changeReason("grounding"), /found in Qloo/);
    assert.match(changeReason("control"), /lost its lead/);
  });

  it("keeps the real-people disclaimer intact", () => {
    assert.match(REAL_PEOPLE_LINE, /real people/);
  });
});

describe("change card copy", () => {
  it("titles the accepted rewrite without jargon", () => {
    assert.equal(ACCEPTED_TITLE, "The rewrite fits better.");
  });

  it("states both scores as percentages, never the gap", () => {
    assert.equal(changeScoreLine(0.61, 0.72), "Was 61%, now 72%.");
    assert.equal(changePct(0.716), 72);
  });

  it("lists gap labels plainly and drops out cleanly when empty", () => {
    assert.equal(gapLine(["solitude"]), "Addresses: solitude");
    assert.equal(gapLine(["  ", "solitude", ""]), "Addresses: solitude");
    assert.equal(gapLine([]), null);
  });

  it("falls back to a plain withheld line", () => {
    assert.equal(WITHHELD_FALLBACK, "The rewrite didn't hold its lead.");
  });
});
