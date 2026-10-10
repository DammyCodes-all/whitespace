/**
 * V2 identity + discovery evidence tests (synthetic only). Owned by Q.
 *
 * No network: classification, parsing, normalization, and
 * budget-exhaustion paths. Live behavior was verified by the private
 * pilot; only aggregates live in `docs/qloo-coverage.md`.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  fetchV2DiscoveryCategory,
  normalizeV2Entities,
} from "./v2-evidence.ts";
import {
  classifyV2Identity,
  parseV2Candidate,
  resolveV2Reference,
  type V2Budget,
  type V2SearchCandidate,
} from "./v2-identity.ts";

function candidate(
  overrides: Partial<V2SearchCandidate> & { id: string; name: string },
): V2SearchCandidate {
  return {
    types: ["urn:entity:movie"],
    akas: [],
    year: null,
    disambiguation: "",
    popularity: 0,
    tagIds: [],
    ...overrides,
  };
}

function exhausted(): V2Budget {
  return { used: 40, ceiling: 40 };
}

describe("parseV2Candidate", () => {
  it("parses the documented search shape", () => {
    const parsed = parseV2Candidate({
      entity_id: "E1",
      name: "Dune",
      types: ["urn:entity:movie"],
      properties: { release_year: 2021, akas: ["Dune (2021)"] },
      popularity: 9.5,
      disambiguation: "2021",
      tags: [{ id: "urn:tag:a", name: "A", type: "t" }],
    });
    assert.deepEqual(parsed, {
      id: "E1",
      name: "Dune",
      types: ["urn:entity:movie"],
      akas: ["Dune (2021)"],
      year: 2021,
      disambiguation: "2021",
      popularity: 9.5,
      tagIds: ["urn:tag:a"],
    });
  });

  it("preserves scalar type fields so wrong-type hits cannot resolve", () => {
    const parsed = parseV2Candidate({
      entity_id: "B1",
      name: "Dune",
      type: "urn:entity:book",
    });
    assert.ok(parsed);
    assert.deepEqual(parsed.types, ["urn:entity:book"]);
    assert.equal(
      classifyV2Identity("Dune", [parsed], "urn:entity:movie").state,
      "not_found",
    );
  });

  it("rejects hits without id or name", () => {
    assert.equal(parseV2Candidate({ name: "X" }), null);
    assert.equal(parseV2Candidate({ entity_id: "E" }), null);
    assert.equal(parseV2Candidate(null), null);
  });
});

describe("classifyV2Identity", () => {
  const type = "urn:entity:movie";

  it("resolves a single exact match, not the first hit", () => {
    const out = classifyV2Identity(
      "Dune",
      [
        candidate({ id: "F1", name: "Dune: Part Two", popularity: 99 }),
        candidate({ id: "F2", name: "Dune", year: 2021, popularity: 1 }),
      ],
      type,
    );
    assert.equal(out.state, "resolved");
    assert.equal(out.entityId, "F2");
  });

  it("matches aliases and normalizes hyphens/case", () => {
    const out = classifyV2Identity(
      "slow-burn",
      [candidate({ id: "F1", name: "Slow Burn", popularity: 5 })],
      type,
    );
    assert.equal(out.state, "resolved");
    const alias = classifyV2Identity(
      "Dune 2021",
      [candidate({ id: "F1", name: "Dune", akas: ["Dune 2021"] })],
      type,
    );
    assert.equal(alias.state, "resolved");
  });

  it("ignores candidates outside the requested type", () => {
    const out = classifyV2Identity(
      "Dune",
      [candidate({ id: "B1", name: "Dune", types: ["urn:entity:book"] })],
      type,
    );
    assert.equal(out.state, "not_found");
  });

  it("reports ambiguity with all exact matches, never a pick", () => {
    const out = classifyV2Identity(
      "Dune",
      [
        candidate({ id: "F1", name: "Dune", year: 1984, popularity: 3 }),
        candidate({ id: "F2", name: "Dune", year: 2021, popularity: 8 }),
      ],
      type,
    );
    assert.equal(out.state, "ambiguous");
    assert.equal(out.entityId, null);
    assert.deepEqual(
      out.exactMatches.map((c) => c.id),
      ["F2", "F1"],
    );
  });

  it("returns not_found with closest names for fuzzy-only results", () => {
    const out = classifyV2Identity(
      "The Sympathy",
      [
        candidate({
          id: "B1",
          name: "Remote Sympathy",
          types: ["urn:entity:book"],
        }),
      ],
      "urn:entity:book",
    );
    assert.equal(out.state, "not_found");
    assert.deepEqual(out.closestNames, ["Remote Sympathy"]);
  });
});

describe("resolveV2Reference without network", () => {
  it("fails closed on budget exhaustion and empty queries", async () => {
    const over = await resolveV2Reference(
      "Dune",
      "urn:entity:movie",
      exhausted(),
    );
    assert.equal(over.state, "request_failed");
    assert.match(over.provenance, /budget exhausted/);
    const empty = await resolveV2Reference("   ", "urn:entity:movie", {
      used: 0,
      ceiling: 40,
    });
    assert.equal(empty.state, "not_found");
  });
});

describe("normalizeV2Entities", () => {
  it("reads results.entities and ranks by position", () => {
    const entities = normalizeV2Entities({
      results: {
        entities: [
          {
            entity_id: "A",
            name: "Alpha",
            subtype: "urn:entity:movie",
            tags: [{ id: "t1", name: "T", type: "x" }],
          },
          { entity_id: "B", name: "Beta", type: "urn:entity:book", tags: [] },
        ],
      },
    });
    assert.deepEqual(
      entities.map((e) => [e.id, e.position]),
      [
        ["A", 1],
        ["B", 2],
      ],
    );
    assert.deepEqual(entities[0].tags, ["t1"]);
  });

  it("reads bare-array results and skips bad entries", () => {
    const entities = normalizeV2Entities({
      results: [
        { entity_id: "A", name: "Alpha" },
        { name: "No id" },
        { entity_id: "B" },
        null,
        { entity_id: "A", name: "Alpha dup" },
      ],
    });
    assert.deepEqual(
      entities.map((e) => e.id),
      ["A"],
    );
  });

  it("yields [] for unknown shapes", () => {
    assert.deepEqual(normalizeV2Entities(null), []);
    assert.deepEqual(normalizeV2Entities({ results: { tags: [] } }), []);
  });
});

describe("fetchV2DiscoveryCategory without network", () => {
  it("fails closed on budget exhaustion and empty seeds", async () => {
    const over = await fetchV2DiscoveryCategory(
      "E1",
      "a",
      "urn:entity:movie",
      [],
      exhausted(),
    );
    assert.equal(over.status, "failed");
    const empty = await fetchV2DiscoveryCategory(
      "  ",
      "a",
      "urn:entity:movie",
      [],
      { used: 0, ceiling: 40 },
    );
    assert.equal(empty.status, "failed");
  });
});
