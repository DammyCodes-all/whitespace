import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { QlooError, resetQuota } from "./client.ts";
import {
  CROSS_DOMAIN_RIVALS,
  discoverRivals,
  shouldReplanWithEntities,
  WORK_TYPE_TO_ENTITY_TYPE,
} from "./rival-discovery.ts";

const SAVED_KEY = process.env.QLOO_API_KEY;
const SAVED_FETCH = globalThis.fetch;

function stubQloo(): string[] {
  process.env.QLOO_API_KEY = "test-key";
  const seen: string[] = [];
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input);
    const type = new URL(url).searchParams.get("filter.type") ?? "";
    seen.push(type);
    return new Response(
      JSON.stringify({
        success: true,
        results: {
          entities: [
            { entity_id: `${type}-1`, name: `Lead ${type}` },
            { entity_id: `${type}-2`, name: `Second ${type}` },
            { entity_id: `${type}-3`, name: `Third ${type}` },
          ],
        },
      }),
      { status: 200 },
    );
  }) as typeof fetch;
  return seen;
}

describe("discoverRivals", () => {
  beforeEach(() => {
    resetQuota();
  });

  afterEach(() => {
    if (SAVED_KEY === undefined) delete process.env.QLOO_API_KEY;
    else process.env.QLOO_API_KEY = SAVED_KEY;
    globalThis.fetch = SAVED_FETCH;
    resetQuota();
  });

  it("spreads rivals across the own domain and cross domains", async () => {
    const seen = stubQloo();
    const out = await discoverRivals({
      tagIds: ["urn:tag:a"],
      entityIds: [],
      workType: "film",
      count: 4,
    });
    assert.equal(out.rivals.length, 4);
    // Round-robin: own domain first, then each cross domain, then back
    // to the own domain — a film pitch is not movie-fans only.
    assert.deepEqual(out.domains, [
      "urn:entity:movie",
      "urn:entity:book",
      "urn:entity:artist",
      "urn:entity:movie",
    ]);
    // One call per filter.type — comma-joined types 400 live.
    assert.deepEqual(seen, [
      "urn:entity:movie",
      "urn:entity:book",
      "urn:entity:artist",
    ]);
    assert.equal(out.calls.length, 3);
    assert.equal(out.rivals[0]?.name, "Fans of Lead urn:entity:movie");
    assert.equal(out.rivals[1]?.name, "Fans of Lead urn:entity:book");
    assert.equal(out.rivals[1]?.reason, "readers");
    assert.equal(out.rivals[2]?.reason, "music listeners");
  });

  it("keeps names and ids from Qloo, one per lead entity", async () => {
    stubQloo();
    const out = await discoverRivals({
      tagIds: ["urn:tag:a"],
      entityIds: [],
      workType: "film",
      count: 3,
    });
    for (const rival of out.rivals) {
      assert.ok(rival.name.startsWith("Fans of "));
      assert.ok(rival.titles.length >= 1);
      assert.ok(rival.titles.every((t) => t.qlooId !== ""));
    }
  });

  it("returns no rivals and no throw when a domain fails", async () => {
    process.env.QLOO_API_KEY = "test-key";
    globalThis.fetch = (async () =>
      new Response("{}", { status: 500 })) as typeof fetch;
    const out = await discoverRivals({
      tagIds: ["urn:tag:a"],
      entityIds: [],
      workType: "film",
      count: 3,
    });
    assert.deepEqual(out.rivals, []);
    assert.equal(out.calls.length, 3);
    // Nothing answered, so an empty result here is an outage, not a
    // finding — the caller must not re-ask the graph from this.
    assert.equal(out.answered, false);
    assert.ok(new QlooError("x", out.calls[0], true) instanceof QlooError);
  });

  it("marks an empty answer as answered, unlike a failed call", async () => {
    // The distinction the re-plan rests on: the graph said "nothing
    // matches", which is a real answer worth asking differently.
    process.env.QLOO_API_KEY = "test-key";
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({ success: true, results: { entities: [] } }),
        {
          status: 200,
        },
      )) as typeof fetch;
    const out = await discoverRivals({
      tagIds: ["urn:tag:a"],
      entityIds: [],
      workType: "film",
      count: 3,
    });
    assert.deepEqual(out.rivals, []);
    assert.equal(out.answered, true);
  });

  it("makes no call without seeds", async () => {
    const seen = stubQloo();
    const out = await discoverRivals({
      tagIds: [],
      entityIds: [],
      workType: "film",
      count: 3,
    });
    assert.deepEqual(out.rivals, []);
    assert.equal(seen.length, 0);
    // No call at all: nothing answered, and nothing was asked.
    assert.equal(out.answered, false);
  });

  it("seeds discovery with every matched tag, not just the first five", async () => {
    // Repeat probe 2026-10-12: truncating the seed to 5 made rival
    // sets swing with LLM word order. All 8 ids must reach the query.
    process.env.QLOO_API_KEY = "test-key";
    const signals: string[] = [];
    globalThis.fetch = (async (input: string | URL | Request) => {
      const url = String(input);
      signals.push(
        new URL(url).searchParams.get("signal.interests.tags") ?? "",
      );
      return new Response(
        JSON.stringify({
          success: true,
          results: {
            entities: [{ entity_id: "e1", name: "Lead" }],
          },
        }),
        { status: 200 },
      );
    }) as typeof fetch;
    const tagIds = Array.from({ length: 8 }, (_, i) => `urn:tag:t${i}`);
    const out = await discoverRivals({
      tagIds,
      entityIds: [],
      workType: "film",
      count: 3,
    });
    assert.equal(signals.length, 3);
    for (const signal of signals) {
      assert.equal(signal, tagIds.join(","));
    }
    assert.ok(out.rivals.length > 0);
  });

  it("cross domains are parameterized per work type", () => {
    assert.ok(
      !CROSS_DOMAIN_RIVALS.film.includes(WORK_TYPE_TO_ENTITY_TYPE.film),
    );
    assert.ok(
      CROSS_DOMAIN_RIVALS.music.every(
        (t) => t !== WORK_TYPE_TO_ENTITY_TYPE.music,
      ),
    );
  });

  it("seed: entities asks the graph with the named titles, not the words", async () => {
    // The second question: "what is related to Moon and Aftersun?"
    // instead of "what matches all eight of the pitch's words?".
    process.env.QLOO_API_KEY = "test-key";
    const sent: { tags: string | null; entities: string | null }[] = [];
    globalThis.fetch = (async (input: string | URL | Request) => {
      const params = new URL(String(input)).searchParams;
      sent.push({
        tags: params.get("signal.interests.tags"),
        entities: params.get("signal.interests.entities"),
      });
      return new Response(
        JSON.stringify({
          success: true,
          results: { entities: [{ entity_id: "e1", name: "Lead" }] },
        }),
        { status: 200 },
      );
    }) as typeof fetch;
    const out = await discoverRivals({
      tagIds: ["urn:tag:a", "urn:tag:b"],
      entityIds: ["moon-id", "arrival-id"],
      workType: "film",
      count: 3,
      seed: "entities",
    });
    assert.equal(sent.length, 3);
    for (const call of sent) {
      assert.equal(call.tags, null);
      assert.equal(call.entities, "moon-id,arrival-id");
    }
    assert.equal(out.seedUsed, "entities");
    assert.ok(out.rivals.length > 0);
  });

  it("seed: entities falls back to the tags when no title resolved", async () => {
    // The user named titles that Qloo did not know, so there is no
    // entity signal to send. The attempt still asks something.
    process.env.QLOO_API_KEY = "test-key";
    const sent: { tags: string | null; entities: string | null }[] = [];
    globalThis.fetch = (async (input: string | URL | Request) => {
      const params = new URL(String(input)).searchParams;
      sent.push({
        tags: params.get("signal.interests.tags"),
        entities: params.get("signal.interests.entities"),
      });
      return new Response(
        JSON.stringify({
          success: true,
          results: { entities: [{ entity_id: "e1", name: "Lead" }] },
        }),
        { status: 200 },
      );
    }) as typeof fetch;
    const out = await discoverRivals({
      tagIds: ["urn:tag:a"],
      entityIds: [],
      workType: "film",
      count: 3,
      seed: "entities",
    });
    for (const call of sent) {
      assert.equal(call.tags, "urn:tag:a");
      assert.equal(call.entities, null);
    }
    assert.equal(out.seedUsed, "tags");
  });

  it("seed: the default asks with the pitch's words and reports the signal", async () => {
    process.env.QLOO_API_KEY = "test-key";
    const sent: { tags: string | null; entities: string | null }[] = [];
    globalThis.fetch = (async (input: string | URL | Request) => {
      const params = new URL(String(input)).searchParams;
      sent.push({
        tags: params.get("signal.interests.tags"),
        entities: params.get("signal.interests.entities"),
      });
      return new Response(
        JSON.stringify({
          success: true,
          results: { entities: [{ entity_id: "e1", name: "Lead" }] },
        }),
        { status: 200 },
      );
    }) as typeof fetch;
    const out = await discoverRivals({
      tagIds: ["urn:tag:a"],
      entityIds: ["moon-id"],
      workType: "film",
      count: 3,
    });
    for (const call of sent) {
      assert.equal(call.tags, "urn:tag:a");
      assert.equal(call.entities, null);
    }
    assert.equal(out.seedUsed, "tags");
  });

  it("replan: only when the first question answered empty and titles exist", () => {
    const base = {
      seedUsed: "tags" as const,
      entityCount: 2,
      firstAttemptAnswered: true,
    };
    // Answered, and empty + a sharper question available → re-ask.
    assert.equal(shouldReplanWithEntities({ ...base, rivalsFound: 0 }), true);
    // The first question worked → no second call, no extra spend.
    assert.equal(shouldReplanWithEntities({ ...base, rivalsFound: 1 }), false);
    // Nobody answered: an outage is not a finding, so no second call.
    assert.equal(
      shouldReplanWithEntities({
        ...base,
        rivalsFound: 0,
        firstAttemptAnswered: false,
      }),
      false,
    );
    // Already asked the entity question → re-asking would repeat it.
    assert.equal(
      shouldReplanWithEntities({
        rivalsFound: 0,
        seedUsed: "entities",
        entityCount: 2,
        firstAttemptAnswered: true,
      }),
      false,
    );
    // No resolved title to re-seed with → nothing to ask instead.
    assert.equal(
      shouldReplanWithEntities({ ...base, rivalsFound: 0, entityCount: 0 }),
      false,
    );
  });

  it("far candidate is the last unused own-domain entity", async () => {
    process.env.QLOO_API_KEY = "test-key";
    globalThis.fetch = (async (input: string | URL | Request) => {
      const type = new URL(String(input)).searchParams.get("filter.type") ?? "";
      const n = type === "urn:entity:movie" ? 4 : 2;
      const entities = Array.from({ length: n }, (_, i) => ({
        entity_id: `${type}-e${i + 1}`,
        name: `Entity ${i + 1} ${type}`,
      }));
      return new Response(
        JSON.stringify({ success: true, results: { entities } }),
        { status: 200 },
      );
    }) as typeof fetch;
    const out = await discoverRivals({
      tagIds: ["urn:tag:a"],
      entityIds: [],
      workType: "film",
      count: 3,
    });
    assert.equal(out.rivals.length, 3);
    // Rivals still build from the top exactly as before.
    assert.equal(out.rivals[0]?.titles[0]?.qlooId, "urn:entity:movie-e1");
    assert.deepEqual(out.farCandidate, {
      id: "urn:entity:movie-e4",
      name: "Entity 4 urn:entity:movie",
      type: "urn:entity:movie",
      member: {
        id: "urn:entity:movie-e3",
        name: "Entity 3 urn:entity:movie",
        type: "urn:entity:movie",
      },
    });
  });

  it("far candidate falls across domains when the own list is used up", async () => {
    process.env.QLOO_API_KEY = "test-key";
    globalThis.fetch = (async (input: string | URL | Request) => {
      const type = new URL(String(input)).searchParams.get("filter.type") ?? "";
      const n = type === "urn:entity:book" ? 3 : 2;
      const entities = Array.from({ length: n }, (_, i) => ({
        entity_id: `${type}-e${i + 1}`,
        name: `Entity ${i + 1} ${type}`,
      }));
      return new Response(
        JSON.stringify({ success: true, results: { entities } }),
        { status: 200 },
      );
    }) as typeof fetch;
    const out = await discoverRivals({
      tagIds: ["urn:tag:a"],
      entityIds: [],
      workType: "film",
      count: 3,
    });
    // Own-domain pair fully used by the first rival; book has one left.
    assert.deepEqual(out.farCandidate, {
      id: "urn:entity:book-e3",
      name: "Entity 3 urn:entity:book",
      type: "urn:entity:book",
      member: null,
    });
  });

  it("far candidate is null when every entity is used or none came back", async () => {
    process.env.QLOO_API_KEY = "test-key";
    globalThis.fetch = (async () => {
      const entities = [1, 2].map((i) => ({
        entity_id: `e${i}`,
        name: `Entity ${i}`,
      }));
      return new Response(
        JSON.stringify({ success: true, results: { entities } }),
        { status: 200 },
      );
    }) as typeof fetch;
    const used = await discoverRivals({
      tagIds: ["urn:tag:a"],
      entityIds: [],
      workType: "film",
      count: 3,
    });
    assert.equal(used.rivals.length, 3);
    assert.equal(used.farCandidate, null);

    resetQuota();
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ success: true, results: [] }), {
        status: 200,
      })) as typeof fetch;
    const empty = await discoverRivals({
      tagIds: ["urn:tag:a"],
      entityIds: [],
      workType: "film",
      count: 3,
    });
    assert.deepEqual(empty.rivals, []);
    assert.equal(empty.farCandidate, null);
  });
});
