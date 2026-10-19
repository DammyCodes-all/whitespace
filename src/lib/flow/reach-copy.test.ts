import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { FlowGapGroup, FlowReach, FlowReachItem } from "./contract.ts";
import {
  buildReachSections,
  joinNames,
  resolveReachSections,
} from "./reach-copy.ts";

function item(name: string, rank: number, description?: string): FlowReachItem {
  return {
    name,
    rank,
    ...(description === undefined ? {} : { description }),
    evidenceId: "call-1",
  };
}

function group(overrides: Partial<FlowReach> = {}): FlowReach {
  return {
    audienceId: "rival-lit",
    audienceName: "Literary fiction about isolation",
    interests: [item("solitude", 1), item("quiet", 2), item("grief", 3)],
    people: [
      item("Mara Voss", 1, "A novelist of quiet, interior fiction."),
      item("Jonas Feld", 2, "A short-story writer."),
    ],
    podcasts: [
      item(
        "Deep Dive Podcast",
        1,
        "A long-form interview show about how films get made.",
      ),
      item("Slow Burn Audio", 2),
    ],
    brands: [item("Field Notes", 1, "A pocket notebook and stationery brand.")],
    places: [],
    ...overrides,
  };
}

function gaps(overrides: Partial<FlowGapGroup> = {}): FlowGapGroup {
  return {
    audienceId: "rival-lit",
    audienceName: "Literary fiction about isolation",
    gaps: [
      { tagId: "t-quiet", label: "quiet", rank: 2 },
      { tagId: "t-grief", label: "grief", rank: 3 },
    ],
    unlabeledCount: 0,
    hasTastes: true,
    ...overrides,
  };
}

describe("joinNames", () => {
  it("uses a natural conjunction for one, two and many names", () => {
    assert.equal(joinNames([]), "");
    assert.equal(joinNames(["Mara"]), "Mara");
    assert.equal(joinNames(["Mara", "Jonas"]), "Mara and Jonas");
    assert.equal(joinNames(["Mara", "Jonas", "Ayo"]), "Mara, Jonas and Ayo");
  });
});

describe("buildReachSections", () => {
  it("writes all four fixed sections from measured items", () => {
    const sections = buildReachSections(group(), gaps());
    assert.equal(
      sections.interests,
      "Their taste list starts with Solitude, then quiet and grief. Quiet and grief are the parts your pitch doesn't reach yet.",
    );
    assert.equal(
      sections.people,
      "Mara Voss, a novelist of quiet, interior fiction, leads, then Jonas Feld.",
    );
    assert.equal(
      sections.podcasts,
      "Deep Dive Podcast, a long-form interview show about how films get made, is the first listen, then Slow Burn Audio.",
    );
    assert.equal(
      sections.brands,
      "Field Notes, a pocket notebook and stationery brand, is the only brand that surfaced.",
    );
    assert.equal(sections.places, null);
  });

  it("uses attached prose and fills missing sections from the draft", () => {
    const draft = buildReachSections(group(), gaps());
    const sections = resolveReachSections(
      group({
        prose: {
          interests: null,
          people: "Mara Voss leads. Jonas Feld follows.",
          podcasts: null,
          brands: "",
          places: null,
        },
      }),
      gaps(),
    );
    assert.equal(sections.people, "Mara Voss leads. Jonas Feld follows.");
    assert.equal(sections.interests, draft.interests);
    assert.equal(sections.brands, draft.brands);
  });

  it("strips a description that starts with the entity name", () => {
    const sections = buildReachSections(
      group({
        brands: [
          item("Waterstones", 1, "Waterstones is the UK's leading bookseller."),
        ],
      }),
    );
    assert.equal(
      sections.brands,
      "Waterstones, the UK's leading bookseller, is the only brand that surfaced.",
    );
  });

  it("keeps only the first sentence of a multi-sentence description", () => {
    const sections = buildReachSections(
      group({
        brands: [
          item(
            "Field Notes",
            1,
            "A pocket notebook and stationery brand. It is based in Portland.",
          ),
        ],
      }),
    );
    assert.equal(
      sections.brands,
      "Field Notes, a pocket notebook and stationery brand, is the only brand that surfaced.",
    );
  });

  it("drops a description it cannot turn into a clean appositive", () => {
    const sections = buildReachSections(
      group({
        people: [item("Mara Voss", 1, "Mara Voss writes at night.")],
      }),
    );
    assert.equal(sections.people, "Mara Voss is the only name that surfaced.");
  });

  it("says the pitch already covers the interests when no gap is listed", () => {
    const sections = buildReachSections(
      group(),
      gaps({ gaps: [{ tagId: "t-other", label: "rain", rank: 1 }] }),
    );
    assert.equal(
      sections.interests,
      "Their taste list starts with Solitude, then quiet and grief. Your pitch already names these.",
    );
  });

  it("stays silent about gaps when the tastes are unknown", () => {
    const sections = buildReachSections(
      group(),
      gaps({ gaps: [], hasTastes: false }),
    );
    assert.equal(
      sections.interests,
      "Their taste list starts with Solitude, then quiet and grief.",
    );
  });

  it("returns null for every unmeasured section", () => {
    const sections = buildReachSections(
      group({
        interests: [],
        people: [],
        podcasts: [],
        brands: [],
        places: [],
      }),
    );
    assert.deepEqual(sections, {
      interests: null,
      people: null,
      podcasts: null,
      brands: null,
      places: null,
    });
  });
});
