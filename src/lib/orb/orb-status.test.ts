/**
 * orb-status: every leg says one true line. Pins exact copy so a future
 * edit that invents progress fails loudly.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CHECK_TAIL_LINE,
  legPrompt,
  legWorkingMessage,
  receiptLine,
  runReceipt,
  SETUP_LINE,
} from "./orb-status.ts";

describe("orb-status", () => {
  it("working messages name the call in flight, never numbers", () => {
    assert.equal(legWorkingMessage("entry"), "Reading your pitch's tags…");
    assert.equal(
      legWorkingMessage("run"),
      "Scoring your idea against audiences…",
    );
    assert.ok(!legWorkingMessage("run").match(/\d/));
  });

  it("titles working message names the titles under check", () => {
    assert.equal(
      legWorkingMessage("titles", "Moon, Arrival"),
      "Checking Moon, Arrival in Qloo…",
    );
    assert.equal(legWorkingMessage("titles"), "Checking titles in Qloo…");
  });

  it("check tail line names the chained reads in flight", () => {
    assert.equal(CHECK_TAIL_LINE, "Reading the titles' tags…");
    assert.ok(!CHECK_TAIL_LINE.match(/\d/));
  });

  it("setup line names the between-leg beat, never numbers", () => {
    assert.equal(SETUP_LINE, "One moment. Setting up the next step.");
    assert.ok(!SETUP_LINE.match(/\d/));
  });

  it("prompts instruct without inventing", () => {
    assert.equal(
      legPrompt("titles"),
      "Name work yours feels close to — Check verifies each in Qloo.",
    );
    assert.ok(!legPrompt("aggregate").match(/\d/));
  });

  it("receipts carry measured counts only", () => {
    assert.equal(receiptLine("tags", 12), "12 tags read.");
    assert.equal(receiptLine("titles", 2, 1), "2 found in Qloo, 1 missing.");
    assert.equal(runReceipt("Strong"), "Strong — measured, not guessed.");
  });
});
