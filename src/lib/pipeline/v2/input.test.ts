import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseV2Input, validatePreparedBrief } from "./input.ts";
import type { V2ConfirmedAnalogy, V2Input } from "./types.ts";

const PITCH = "A quiet\n\tfilm about a lonely worker, not a thriller.";
const rawInput = () => ({ pitchText: PITCH, workType: "film" });

function confirmation(): V2ConfirmedAnalogy {
  return {
    aspectId: "reviewed-tone",
    facet: "tone",
    excerpt: "quiet\n\tfilm",
    interpretation: "  An intimate tone.  ",
    entityId: "entity-tone",
    entityName: "Canonical tone",
    entityType: "urn:entity:movie",
    selectedName: "  Selected  tone  ",
    analogy: "  Intimate and quiet.  ",
  };
}

function preparedInput(): V2Input {
  return {
    pitchText: PITCH,
    workType: "film",
    comparisons: ["Comparison one", "Comparison two"],
    contrasts: ["Not a thriller"],
    correctionOf: "reviewed-run",
    confirmedAnalogies: [confirmation()],
    preparedBrief: {
      pitchText: PITCH,
      workType: "film",
      brief: {
        interpretation: "  Reading: quiet isolation.  ",
        aspects: [
          {
            id: "reviewed-tone",
            facet: "tone",
            excerpt: "quiet\n\tfilm",
            interpretation: "  An intimate tone.  ",
          },
          {
            id: "reviewed-premise",
            facet: "premise",
            excerpt: "lonely worker",
            interpretation: "Isolation as the premise.",
          },
        ],
        constraints: ["  Preserve the worker's isolation.  "],
        contrasts: ["Not a thriller"],
        unrepresentable: [],
      },
      references: [
        {
          aspectId: "reviewed-premise",
          candidates: [
            {
              name: "Premise reference",
              entityType: "urn:entity:book",
              analogy: "Isolation.",
            },
          ],
        },
        {
          aspectId: "reviewed-tone",
          candidates: [
            {
              name: "Other tone",
              entityType: "urn:entity:movie",
              analogy: "Another analogy.",
            },
            {
              name: "  Selected  tone  ",
              entityType: "urn:entity:movie",
              analogy: "  Intimate and quiet.  ",
            },
          ],
        },
      ],
    },
  };
}

describe("parseV2Input: API bad-input boundary", () => {
  it("rejects malformed requests and old positional approvals without calling providers", () => {
    const parsed = parseV2Input(rawInput());
    assert.equal(parsed.ok, true);
    if (parsed.ok) assert.equal(parsed.input.pitchText, PITCH);
    for (const body of [
      null,
      [],
      "pitch",
      {},
      { ...rawInput(), pitchText: " \n\t " },
      { ...rawInput(), pitchText: 1 },
      { ...rawInput(), workType: "" },
      { ...rawInput(), workType: "app" },
      { ...rawInput(), comparisons: "Title" },
      { ...rawInput(), comparisons: ["Title", 1] },
      { ...rawInput(), contrasts: null },
      { ...rawInput(), contrasts: [""] },
      { ...rawInput(), correctionOf: 1 },
      { ...rawInput(), correctionOf: "   " },
      { ...rawInput(), confirmedAnalogies: ["a-1"] },
      { ...rawInput(), confirmedAnalogies: [null] },
      { ...rawInput(), confirmedAnalogies: [{}] },
      { ...rawInput(), confirmedAnalogies: null },
      { ...rawInput(), preparedBrief: null },
    ]) {
      const result = parseV2Input(body);
      assert.equal(result.ok, false, JSON.stringify(body));
      if (!result.ok) assert.ok(result.error.trim());
    }
  });

  it("accepts exact structured approvals and preserves reviewed whitespace and ids without trusting identity claims", () => {
    const input = preparedInput();
    const before = structuredClone(input);
    const parsed = parseV2Input(input);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.deepEqual(parsed.input.confirmedAnalogies, [confirmation()]);
    assert.equal(parsed.input.pitchText, PITCH);
    assert.deepEqual(parsed.input.comparisons, input.comparisons);
    assert.deepEqual(parsed.input.contrasts, input.contrasts);
    assert.equal(parsed.input.correctionOf, "reviewed-run");
    const proposal = validatePreparedBrief(parsed.input);
    assert.ok(proposal);
    assert.deepEqual(proposal.brief, input.preparedBrief?.brief);
    assert.deepEqual(proposal.references, [
      {
        aspectId: "reviewed-premise",
        candidates: [
          {
            name: "Premise reference",
            entityType: "urn:entity:book",
            analogy: "Isolation.",
          },
        ],
      },
      {
        aspectId: "reviewed-tone",
        candidates: [
          {
            name: "  Selected  tone  ",
            entityType: "urn:entity:movie",
            analogy: "  Intimate and quiet.  ",
          },
        ],
      },
    ]);
    assert.deepEqual(
      input,
      before,
      "validation must not mutate the reviewed snapshot",
    );
    parsed.input.confirmedAnalogies[0].entityId = "client-chosen-id";
    assert.ok(
      validatePreparedBrief(parsed.input),
      "fresh identity, not this validator, must adjudicate canonical ids",
    );
  });

  it("rejects pitch/work mismatches and snapshot bridges that changed even only in whitespace", () => {
    const mutations: ((input: V2Input) => void)[] = [
      (input) => {
        input.pitchText += " ";
      },
      (input) => {
        input.workType = "book";
      },
      (input) => {
        if (input.preparedBrief)
          input.preparedBrief.pitchText = PITCH.replace(/\s+/g, " ");
      },
      (input) => {
        if (input.preparedBrief)
          input.preparedBrief.brief.aspects[0].excerpt = "quiet film";
      },
      (input) => {
        if (input.preparedBrief)
          input.preparedBrief.brief.aspects[0].interpretation =
            "An intimate tone.";
      },
      (input) => {
        if (input.preparedBrief)
          input.preparedBrief.references[1].candidates[1].name =
            "Selected tone";
      },
      (input) => {
        if (input.preparedBrief)
          input.preparedBrief.references[1].candidates[1].analogy =
            "Intimate and quiet.";
      },
      (input) => {
        if (input.preparedBrief)
          input.preparedBrief.references[1].candidates[1].entityType =
            "urn:entity:book";
      },
      (input) => {
        if (input.preparedBrief)
          input.preparedBrief.references[1].candidates.reverse();
        input.confirmedAnalogies = [{ ...confirmation(), aspectId: "a-1" }];
      },
    ];
    for (const mutate of mutations) {
      const input = preparedInput();
      mutate(input);
      assert.equal(validatePreparedBrief(input), null);
      assert.equal(parseV2Input(input).ok, false);
    }
  });
});
