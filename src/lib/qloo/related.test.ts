import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { RELATED_FIXTURES } from "../fixtures/related-fixtures.ts";
import { TAG_LABELS } from "../fixtures/tag-labels.ts";
import { TASTE_FIXTURES } from "../fixtures/taste-lists.ts";
import type { Audience } from "../types.ts";
import type { RelatedKind } from "./related.ts";
import {
  dedupeUserTitles,
  extractRelated,
  fetchRelated,
  fetchRelatedKind,
  kindToFilterType,
  RELATED_TRIM,
} from "./related.ts";

const HYP: Audience = {
  id: "hyp",
  kind: "hypothesis",
  name: "Slow science-fiction",
  titles: [
    {
      query: "Moon",
      qlooId: "moon-id",
      name: "Moon",
      type: "urn:entity:movie",
    },
    {
      query: "Arrival",
      qlooId: "arrival-id",
      name: "Arrival",
      type: "urn:entity:movie",
    },
  ],
  notFoundTitles: [],
};

describe("kindToFilterType", () => {
  it("maps every kind to its Insights entity type", () => {
    assert.equal(kindToFilterType("podcast"), "urn:entity:podcast");
    assert.equal(kindToFilterType("person"), "urn:entity:person");
    assert.equal(kindToFilterType("brand"), "urn:entity:brand");
    assert.equal(kindToFilterType("place"), "urn:entity:place");
  });

  it("throws on unknown kinds", () => {
    assert.throws(() => kindToFilterType("nope" as RelatedKind));
  });
});

describe("extractRelated", () => {
  it("ranks by response position, never by scores", () => {
    const items = extractRelated(
      {
        success: true,
        results: {
          entities: [
            { entity_id: "b", name: "Second", affinity: 0.1 },
            { entity_id: "a", name: "First", affinity: 0.99 },
          ],
        },
      },
      "brand",
      "call-1",
    );
    assert.deepEqual(
      items.map((i) => i.entityId),
      ["b", "a"],
    );
    assert.deepEqual(
      items.map((i) => i.affinityRank),
      [1, 2],
    );
    assert.ok(items.every((i) => i.callId === "call-1" && i.kind === "brand"));
  });

  it("accepts a bare-array results shape and rejects unknown shapes", () => {
    const bare = extractRelated(
      { results: [{ entity_id: "x", name: "X" }] },
      "place",
      "c",
    );
    assert.equal(bare.length, 1);
    assert.deepEqual(extractRelated({ results: {} }, "place", "c"), []);
    assert.deepEqual(extractRelated(null, "place", "c"), []);
  });

  it("skips nameless, id-less, and duplicated entities", () => {
    const items = extractRelated(
      {
        results: {
          entities: [
            { entity_id: "a", name: "A" },
            { entity_id: "", name: "No id" },
            { entity_id: "b", name: "" },
            { entity_id: "a", name: "A again" },
          ],
        },
      },
      "person",
      "c",
    );
    assert.deepEqual(
      items.map((i) => i.entityId),
      ["a"],
    );
  });
});

describe("dedupeUserTitles", () => {
  it("removes user titles by id and by normalized name", () => {
    const items = extractRelated(RELATED_FIXTURES.podcast, "podcast", "c");
    assert.equal(items.length, 6);
    const kept = dedupeUserTitles(items, ["moon-id"], ["Arrival"]);
    assert.deepEqual(
      kept.map((i) => i.entityId),
      ["p01", "p02", "p05", "p07"],
    );
  });

  it("still trims to five after exclusions", () => {
    const items = extractRelated(RELATED_FIXTURES.person, "person", "c");
    const kept = dedupeUserTitles(items, ["pe01", "pe02"], []).slice(
      0,
      RELATED_TRIM,
    );
    assert.equal(kept.length, 5);
    assert.deepEqual(
      kept.map((i) => i.entityId),
      ["pe03", "pe04", "pe05", "pe06", "pe07"],
    );
  });
});

describe("fetchRelatedKind", () => {
  it("fetches nothing without titles, with a null trace", async () => {
    const result = await fetchRelatedKind({ ...HYP, titles: [] }, "brand");
    assert.deepEqual(result.items, []);
    assert.equal(result.call, null);
  });

  it("returns items plus a trace for a titled audience", async () => {
    const result = await fetchRelatedKind(HYP, "brand", []);
    assert.equal(result.kind, "brand");
    assert.ok(Array.isArray(result.items));
    assert.ok(result.call !== null && typeof result.call.endpoint === "string");
  });
});

describe("fetchRelated", () => {
  it("covers all four categories in one batch", async () => {
    const results = await fetchRelated({ ...HYP, titles: [] });
    assert.deepEqual(
      results.map((r) => r.kind),
      ["podcast", "person", "brand", "place"],
    );
    assert.ok(results.every((r) => r.items.length === 0 && r.call === null));
  });
});

describe("tag labels stub", () => {
  it("labels every taste tag id used in fixtures", () => {
    const missing: string[] = [];
    for (const envelope of Object.values(TASTE_FIXTURES)) {
      for (const e of envelope.results.entities) {
        if (TAG_LABELS[e.tag_id] === undefined) missing.push(e.tag_id);
      }
    }
    assert.deepEqual(missing, []);
  });
});
