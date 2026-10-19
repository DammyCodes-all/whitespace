import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { describeLabels, pickLogLine } from "./pick-log.ts";

describe("pickLogLine", () => {
  it("names a genuine no-cut pass", () => {
    const line = pickLogLine({
      candidateCount: 4,
      keptCount: 4,
      ms: 1200,
      outcome: { kind: "kept-all" },
    });
    assert.match(line, /kept 4, cut 0/);
    assert.match(line, /model kept every candidate/);
  });

  it("lists the labels that were cut", () => {
    const line = pickLogLine({
      candidateCount: 3,
      keptCount: 1,
      ms: 900,
      outcome: { kind: "cut", labels: ["school", "romance"] },
    });
    assert.match(line, /kept 1, cut 2/);
    assert.match(line, /"school", "romance"/);
  });

  it("distinguishes fail-open from a model that cut nothing", () => {
    const line = pickLogLine({
      candidateCount: 3,
      keptCount: 3,
      ms: 20000,
      outcome: { kind: "fail-open", reason: "groq: timed out" },
    });
    assert.match(line, /FAIL-OPEN, nothing cut/);
    assert.match(line, /groq: timed out/);
  });

  it("marks a valid empty kept list as a cut-all judgment", () => {
    const line = pickLogLine({
      candidateCount: 3,
      keptCount: 0,
      ms: 800,
      outcome: { kind: "cut-all" },
    });
    assert.match(line, /cut every candidate/);
  });

  it("names an unhandled 500", () => {
    const line = pickLogLine({
      candidateCount: 2,
      keptCount: 0,
      ms: 10,
      outcome: { kind: "error", reason: "boom" },
    });
    assert.match(line, /ERROR 500: boom/);
  });
});

describe("describeLabels", () => {
  it("caps the list so a long pool cannot flood the terminal", () => {
    const labels = Array.from({ length: 15 }, (_, i) => `tag ${i}`);
    const text = describeLabels(labels);
    assert.match(text, /\+3 more/);
    assert.equal(text.match(/"/g)?.length, 24);
  });

  it("truncates a long single label", () => {
    const text = describeLabels(["x".repeat(80)]);
    assert.match(text, /…/);
  });
});
