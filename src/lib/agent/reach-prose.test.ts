import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { FlowGapGroup, FlowReach } from "../flow/contract.ts";
import { LlmError } from "./llm-client.ts";
import {
  buildReachFacts,
  type ReachFactAudience,
  toReachProseMap,
} from "./reach-prose.ts";

function reach(): FlowReach {
  return {
    audienceId: "rival-lit",
    audienceName: "Literary fiction about isolation",
    interests: [
      { name: "solitude", rank: 1, evidenceId: "c1" },
      { name: "quiet", rank: 2, evidenceId: "c1" },
      { name: "grief", rank: 3, evidenceId: "c1" },
    ],
    people: [
      {
        name: "Mara Voss",
        description: "A novelist of quiet, interior fiction.",
        rank: 1,
        evidenceId: "c2",
      },
      {
        name: "Jonas Feld",
        description: "A short-story writer.",
        rank: 2,
        evidenceId: "c2",
      },
    ],
    podcasts: [
      {
        name: "Deep Dive Podcast",
        description: "A long-form interview show about how films get made.",
        rank: 1,
        evidenceId: "c3",
      },
      { name: "Slow Burn Audio", rank: 2, evidenceId: "c3" },
    ],
    brands: [
      {
        name: "Field Notes",
        description: "A pocket notebook and stationery brand.",
        rank: 1,
        evidenceId: "c4",
      },
    ],
    places: [],
  };
}

function gaps(): FlowGapGroup {
  return {
    audienceId: "rival-lit",
    audienceName: "Literary fiction about isolation",
    gaps: [
      { tagId: "t-quiet", label: "quiet", rank: 2 },
      { tagId: "t-grief", label: "grief", rank: 3 },
      { tagId: "t-rain", label: "rain", rank: 4 },
    ],
    unlabeledCount: 0,
    hasTastes: true,
  };
}

function facts(): ReachFactAudience[] {
  return buildReachFacts([reach()], [gaps()]);
}

function validSections(): Record<string, string | null> {
  return {
    interests:
      "Solitude leads, then quiet and grief. Quiet and grief are the parts your pitch doesn't reach yet.",
    people:
      "Mara Voss, a novelist of quiet, interior fiction, leads. Jonas Feld follows, a short-story writer.",
    podcasts:
      "Deep Dive Podcast is the first listen, then Slow Burn Audio comes next.",
    brands: "Field Notes is the only brand that surfaced.",
    places: null,
  };
}

function output(
  sections: Record<string, string | null>,
  id = "rival-lit",
): unknown {
  return { audiences: [{ id, sections }] };
}

describe("buildReachFacts", () => {
  it("keeps only interest gaps and the full measured descriptions", () => {
    const [fact] = facts();
    assert.deepEqual(fact.gaps, ["quiet", "grief"]);
    assert.equal(fact.gapsKnown, true);
    assert.equal(
      fact.people[0].description,
      "A novelist of quiet, interior fiction.",
    );
    assert.equal(fact.places.length, 0);
    assert.ok(fact.draft.people?.includes("Mara Voss"));
  });

  it("marks unknown tastes without inventing zero gaps", () => {
    const [fact] = buildReachFacts(
      [reach()],
      [{ ...gaps(), hasTastes: false, gaps: [] }],
    );
    assert.equal(fact.gapsKnown, false);
    assert.deepEqual(fact.gaps, []);
  });
});

describe("toReachProseMap", () => {
  it("accepts grounded sections and keeps every heading", () => {
    const map = toReachProseMap(output(validSections()), facts());
    const sections = map["rival-lit"];
    assert.ok(sections !== undefined);
    assert.equal(sections.interests, validSections().interests);
    assert.equal(sections.people, validSections().people);
    assert.equal(sections.podcasts, validSections().podcasts);
    assert.equal(sections.brands, validSections().brands);
    assert.equal(sections.places, undefined);
  });

  it("drops only the section that invents a proper noun", () => {
    const sections = validSections();
    sections.people = "Mara Voss leads, then Jonas Feld, a Vienna novelist.";
    const map = toReachProseMap(output(sections), facts());
    assert.equal(map["rival-lit"]?.people, undefined);
    assert.equal(map["rival-lit"]?.brands, sections.brands);
  });

  it("rejects a missing entity, wrong rank order, new digits and markdown", () => {
    const missing = validSections();
    missing.people = "Mara Voss leads the list.";
    assert.equal(
      toReachProseMap(output(missing), facts())["rival-lit"]?.people,
      undefined,
    );

    const wrongOrder = validSections();
    wrongOrder.people = "Jonas Feld leads, then Mara Voss.";
    assert.equal(
      toReachProseMap(output(wrongOrder), facts())["rival-lit"]?.people,
      undefined,
    );

    const newNumber = validSections();
    newNumber.people = "Mara Voss leads, then Jonas Feld. Three people follow.";
    assert.equal(
      toReachProseMap(output(newNumber), facts())["rival-lit"]?.people,
      undefined,
    );

    const markdown = validSections();
    markdown.people =
      "**Mara Voss** leads, then Jonas Feld, a short-story writer.";
    assert.equal(
      toReachProseMap(output(markdown), facts())["rival-lit"]?.people,
      undefined,
    );
  });

  it("rejects speculation and a missing precomputed gap", () => {
    const speculation = validSections();
    speculation.people =
      "Mara Voss is known for quiet, interior fiction. Jonas Feld follows.";
    assert.equal(
      toReachProseMap(output(speculation), facts())["rival-lit"]?.people,
      undefined,
    );

    const noGap = validSections();
    noGap.interests =
      "Solitude leads, then quiet and grief. These are the strongest signals.";
    assert.equal(
      toReachProseMap(output(noGap), facts())["rival-lit"]?.interests,
      undefined,
    );
  });

  it("throws on a shape with no audiences, and ignores unknown ids", () => {
    assert.throws(
      () => toReachProseMap({}, facts()),
      (error: unknown) => error instanceof LlmError,
    );
    const map = toReachProseMap(output(validSections(), "other"), facts());
    assert.deepEqual(map, {});
  });
});
