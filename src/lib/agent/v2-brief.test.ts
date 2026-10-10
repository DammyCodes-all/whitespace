/**
 * V2 brief proposal tests (synthetic only). Owned by U.
 *
 * Validation, fidelity, and repair paths with a stubbed transport —
 * no network, no keys.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { LlmError } from "./llm-client.ts";
import { proposeV2Brief, toV2BriefProposal } from "./v2-brief.ts";

const PITCH =
  "A quiet science-fiction film about a lonely worker on a space station.";

function valid() {
  return {
    interpretation: "My reading: a slow, lonely sci-fi story.",
    aspects: [
      {
        facet: "premise",
        excerpt: "lonely worker on a space station",
        interpretation: "Isolation as the engine.",
      },
      {
        facet: "tone",
        excerpt: "quiet science-fiction film",
        interpretation: "Quiet, not spectacle.",
      },
    ],
    constraints: [] as string[],
    contrasts: ["Fast franchise action"],
    unrepresentable: ["first-time director constraints"],
    references: [
      {
        aspectIndex: 0,
        candidates: [
          {
            name: "Moon",
            entityType: "urn:entity:movie",
            analogy: "One worker, one station.",
          },
        ],
      },
      {
        aspectIndex: 1,
        candidates: [
          {
            name: "Her",
            entityType: "urn:entity:movie",
            analogy: "Intimate sci-fi tone.",
          },
        ],
      },
    ],
  };
}

describe("toV2BriefProposal", () => {
  it("accepts a valid proposal and assigns aspect ids", () => {
    const out = toV2BriefProposal(valid(), PITCH);
    assert.deepEqual(
      out.brief.aspects.map((a) => a.id),
      ["a-1", "a-2"],
    );
    assert.equal(out.references[0].aspectId, "a-1");
  });

  it("allows zero aspects for meaningless pitches", () => {
    const out = toV2BriefProposal(
      { ...valid(), aspects: [], references: [] },
      PITCH,
    );
    assert.deepEqual(out.brief.aspects, []);
  });

  it("rejects invented excerpts, bad facets, and overflow aspects", () => {
    const badExcerpt = structuredClone(valid());
    badExcerpt.aspects[0].excerpt = "a sweeping romance on Mars";
    assert.throws(() => toV2BriefProposal(badExcerpt, PITCH), LlmError);
    const badFacet = structuredClone(valid());
    badFacet.aspects[0].facet = "demographic";
    assert.throws(() => toV2BriefProposal(badFacet, PITCH), LlmError);
    const overflow = structuredClone(valid());
    overflow.aspects.push(
      { facet: "theme", excerpt: "lonely worker", interpretation: "X." },
      { facet: "form", excerpt: "space station", interpretation: "Y." },
    );
    assert.throws(() => toV2BriefProposal(overflow, PITCH), LlmError);
  });

  it("rejects repeated facets instead of manufacturing dimensions", () => {
    const duplicate = valid();
    duplicate.aspects[1].facet = "premise";
    assert.throws(() => toV2BriefProposal(duplicate, PITCH), LlmError);
  });

  it("rejects normalized duplicate excerpts or interpretations across facets", () => {
    const pitch = `${PITCH} LONELY  worker on a space station`;
    const duplicateExcerpt = valid();
    duplicateExcerpt.aspects[1].excerpt = "LONELY  worker on a space station";
    assert.throws(() => toV2BriefProposal(duplicateExcerpt, pitch), LlmError);

    const duplicateReading = valid();
    duplicateReading.aspects[1].interpretation = "  ISOLATION  as the engine. ";
    assert.throws(() => toV2BriefProposal(duplicateReading, PITCH), LlmError);
  });

  it("preserves exact excerpt whitespace and rejects normalized substitutes", () => {
    const pitch = "A quiet\n\tscience-fiction film about a lonely worker.";
    const proposal = valid();
    proposal.aspects = [
      {
        facet: "tone",
        excerpt: "quiet\n\tscience-fiction film",
        interpretation: "Quiet, not spectacle.",
      },
    ];
    proposal.references = [];
    assert.equal(
      toV2BriefProposal(proposal, pitch).brief.aspects[0].excerpt,
      "quiet\n\tscience-fiction film",
    );
    proposal.aspects[0].excerpt = "quiet science-fiction film";
    assert.throws(() => toV2BriefProposal(proposal, pitch), LlmError);
  });

  it("rejects repeated references to the same aspect", () => {
    const duplicate = valid();
    duplicate.references[1].aspectIndex = 0;
    assert.throws(() => toV2BriefProposal(duplicate, PITCH), LlmError);
  });

  it("rejects bad reference targets, types, and empty candidates", () => {
    const badTarget = structuredClone(valid());
    badTarget.references[0].aspectIndex = 9;
    assert.throws(() => toV2BriefProposal(badTarget, PITCH), LlmError);
    const badType = structuredClone(valid());
    badType.references[0].candidates[0].entityType = "urn:entity:tag";
    assert.throws(() => toV2BriefProposal(badType, PITCH), LlmError);
    const noCands = structuredClone(valid());
    noCands.references[0].candidates = [];
    assert.throws(() => toV2BriefProposal(noCands, PITCH), LlmError);
  });
});

describe("proposeV2Brief", () => {
  it("rejects empty pitches without calling the model", async () => {
    let called = false;
    await assert.rejects(
      proposeV2Brief("   ", "film", async () => {
        called = true;
        return "{}";
      }),
      LlmError,
    );
    assert.equal(called, false);
  });

  it("runs one structured repair, then returns the fixed proposal", async () => {
    const bad = structuredClone(valid());
    bad.aspects[0].excerpt = "invented";
    const calls: string[][] = [];
    const out = await proposeV2Brief(PITCH, "film", async (messages) => {
      calls.push(messages.map((m) => m.role));
      return JSON.stringify(calls.length === 1 ? bad : valid());
    });
    assert.equal(calls.length, 2);
    assert.deepEqual(calls[1], ["system", "user", "user"]);
    assert.equal(out.brief.aspects.length, 2);
  });

  it("retains the full pitch, including constraints beyond 2000 characters", async () => {
    const pitch = `  ${"A quiet scene. ".repeat(160)}No romance or action.  `;
    const proposal = valid();
    proposal.aspects = [
      {
        facet: "tone",
        excerpt: "No romance or action.",
        interpretation: "Excludes romance and action.",
      },
    ];
    proposal.references = [];
    proposal.constraints = ["No romance or action."];
    let calls = 0;
    const out = await proposeV2Brief(pitch, "film", async (messages) => {
      calls += 1;
      assert.equal(messages[1].content, `Pitch (film): ${pitch}`);
      return JSON.stringify(proposal);
    });
    assert.equal(calls, 1);
    assert.equal(out.brief.aspects[0].excerpt, "No romance or action.");
  });

  it("allows proposed analogies without adding unstated pitch themes or genre", async () => {
    await proposeV2Brief(PITCH, "film", async (messages) => {
      assert.match(messages[0].content, /may propose.*not named/i);
      assert.match(messages[0].content, /never add.*genre.*themes/i);
      assert.doesNotMatch(
        messages[0].content,
        /never add genre, themes, or references the pitch does not state/i,
      );
      return JSON.stringify(valid());
    });
  });

  it("repairs duplicate aspects rather than returning artificial dimensions", async () => {
    const duplicate = valid();
    duplicate.aspects[1].facet = "premise";
    let calls = 0;
    const out = await proposeV2Brief(PITCH, "film", async () => {
      calls += 1;
      return JSON.stringify(calls === 1 ? duplicate : valid());
    });
    assert.equal(calls, 2);
    assert.equal(out.brief.aspects[1].facet, "tone");
  });

  it("throws when the repair still fails", async () => {
    await assert.rejects(
      proposeV2Brief(PITCH, "film", async () => JSON.stringify({ nope: true })),
      LlmError,
    );
  });
});
