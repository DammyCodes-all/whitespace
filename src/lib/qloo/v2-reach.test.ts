/**
 * V2 reach retrieval tests (synthetic only, no network). Owned by Q.
 *
 * Covers §4G lead normalization and guards: defensive parsing, id+name
 * pairing, per-query caps, http-only links, empty-seed and
 * budget-exhausted short-circuits that never send a request.
 */

import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import type { V2Budget } from "./v2-identity.ts";
import {
  fetchV2ReachCategory,
  fetchV2ReachForNeighborhood,
  normalizeV2Leads,
  V2_REACH_CATEGORIES,
} from "./v2-reach.ts";

function budget(used = 0, ceiling = 40): V2Budget {
  return { used, ceiling };
}

function response(entries: unknown[]) {
  return { results: { entities: entries } };
}

describe("normalizeV2Leads", () => {
  it("pairs ids with names and drops id-less or nameless entries", () => {
    const leads = normalizeV2Leads(
      response([
        { entity_id: "P1", name: "Good Pod", subtype: "urn:entity:podcast" },
        { entity_id: "", name: "No Id" },
        { name: "No Id At All" },
        { entity_id: "P2", name: "   " },
      ]),
      "run:n1",
      ["C1"],
      "urn:entity:podcast",
      "stub",
    );
    assert.deepEqual(
      leads.map((l) => l.id),
      ["P1"],
    );
    assert.equal(leads[0].neighborhoodId, "run:n1");
    assert.deepEqual(leads[0].seedIds, ["C1"]);
  });

  it("caps leads per query and dedupes repeats", () => {
    const entries = ["A", "B", "C", "D", "A"].map((id) => ({
      entity_id: id,
      name: `Name ${id}`,
    }));
    const leads = normalizeV2Leads(
      response(entries),
      "run:n1",
      ["C1"],
      "urn:entity:person",
      "stub",
    );
    assert.deepEqual(
      leads.map((l) => l.id),
      ["A", "B", "C"],
    );
  });

  it("surfaces http(s) links only, never invented ones", () => {
    const leads = normalizeV2Leads(
      response([
        { entity_id: "A", name: "Linked", url: "https://example.com/show" },
        { entity_id: "B", name: "Sneaky", url: "javascript:alert(1)" },
        { entity_id: "C", name: "Unlinked" },
      ]),
      "run:n1",
      ["C1"],
      "urn:entity:podcast",
      "stub",
    );
    assert.equal(leads[0].link, "https://example.com/show");
    assert.equal(leads[1].link, null);
    assert.equal(leads[2].link, null);
  });

  it("falls back to the queried category when type is missing", () => {
    const [lead] = normalizeV2Leads(
      response([{ entity_id: "A", name: "Typeless" }]),
      "run:n1",
      ["C1"],
      "urn:entity:person",
      "stub",
    );
    assert.equal(lead.type, "urn:entity:person");
  });

  it("returns nothing for misshapen payloads", () => {
    assert.deepEqual(normalizeV2Leads(null, "n", [], "c", "s"), []);
    assert.deepEqual(
      normalizeV2Leads({ results: { entities: "nope" } }, "n", [], "c", "s"),
      [],
    );
  });
});

describe("fetchV2ReachCategory transport", () => {
  const savedFetch = globalThis.fetch;
  const names = ["QLOO_API_KEY", "QLOO_MAX_RETRIES"] as const;
  const savedEnv = new Map(names.map((name) => [name, process.env[name]]));

  beforeEach(() => {
    process.env.QLOO_API_KEY = "test-key";
    process.env.QLOO_MAX_RETRIES = "0";
    globalThis.fetch = (async () => {
      throw new Error("No live API calls allowed.");
    }) as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = savedFetch;
    for (const name of names) {
      const value = savedEnv.get(name);
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });

  it("cites the structured query on outcomes and every returned lead", async () => {
    let fetches = 0;
    globalThis.fetch = (async (_url, init) => {
      fetches += 1;
      assert.equal(new Headers(init?.headers).get("X-Api-Key"), "test-key");
      return new Response(
        JSON.stringify(
          response([
            {
              entity_id: "P1",
              name: "Good Pod",
              url: "https://example.com/show",
            },
            { entity_id: "P2", name: "Another Pod" },
          ]),
        ),
        { status: 200 },
      );
    }) as typeof fetch;
    const b: V2Budget = { used: 0, ceiling: 1, calls: [] };
    const out = await fetchV2ReachCategory(
      "n1",
      ["C1", "C2", "C3", "C4"],
      "urn:entity:podcast",
      b,
    );
    assert.equal(out.status, "ok");
    assert.equal(b.used, 1);
    assert.deepEqual(out.seedIds, ["C1", "C2", "C3"]);
    assert.equal(out.callId, b.calls?.[0].id);
    assert.equal(b.calls?.[0].params["signal.interests.entities"], "C1,C2,C3");
    assert.equal(out.leads.length, 2);
    for (const lead of out.leads) assert.equal(lead.callId, out.callId);
    const cached = await fetchV2ReachCategory(
      "n2",
      ["C1", "C2", "C3"],
      "urn:entity:podcast",
      b,
    );
    assert.equal(cached.status, "ok");
    assert.equal(fetches, 1);
    assert.equal(b.used, 1);
    assert.equal(b.calls?.[1].attempts, 0);
    assert.notEqual(out.callId, cached.callId);
    assert.equal(cached.leads[0].callId, cached.callId);
    assert.equal(cached.leads[0].neighborhoodId, "n2");
  });

  it("keeps category-specific failure details in partial reach results", async () => {
    globalThis.fetch = (async (url) => {
      const category = new URL(String(url)).searchParams.get("filter.type");
      return category === "urn:entity:podcast"
        ? new Response(
            JSON.stringify(response([{ entity_id: "P1", name: "Good Pod" }])),
            { status: 200 },
          )
        : new Response(
            JSON.stringify({ error: "synthetic person capability failure" }),
            { status: 403 },
          );
    }) as typeof fetch;
    const b: V2Budget = { used: 0, ceiling: 2, calls: [] };
    const outcomes = await fetchV2ReachForNeighborhood("n1", ["C1"], b);
    assert.deepEqual(
      outcomes.map((out) => out.status),
      ["ok", "failed"],
    );
    const failure = outcomes[1];
    assert.equal(failure.category, "urn:entity:person");
    assert.match(failure.queryProvenance, /403/);
    assert.match(failure.error ?? "", /403/);
    const call = b.calls?.find((entry) => entry.id === failure.callId);
    assert.ok(call);
    assert.deepEqual(call.response, {
      error: "synthetic person capability failure",
    });
    assert.equal(call.attempts, 1);
    assert.equal(b.used, 2);
  });
});

describe("fetchV2ReachCategory guards", () => {
  it("short-circuits empty seeds without spending budget", async () => {
    const b = budget();
    const out = await fetchV2ReachCategory(
      "run:n1",
      [],
      "urn:entity:podcast",
      b,
    );
    assert.equal(out.status, "failed");
    assert.deepEqual(out.leads, []);
    assert.equal(b.used, 0);
  });

  it("short-circuits exhausted budgets without sending a request", async () => {
    const b = budget(40, 40);
    const out = await fetchV2ReachCategory(
      "run:n1",
      ["C1", "C2"],
      "urn:entity:podcast",
      b,
    );
    assert.equal(out.status, "failed");
    assert.ok(out.queryProvenance.includes("budget exhausted"));
    assert.equal(b.used, 40);
  });

  it("fans out over podcasts and people", async () => {
    assert.deepEqual(
      [...V2_REACH_CATEGORIES],
      ["urn:entity:podcast", "urn:entity:person"],
    );
    const b = budget(40, 40);
    const outs = await fetchV2ReachForNeighborhood("run:n1", ["C1"], b);
    assert.deepEqual(
      outs.map((o) => o.status),
      ["failed", "failed"],
    );
    assert.equal(b.used, 40);
  });
});
