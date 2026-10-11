import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { QlooError, resetQuota } from "./client.ts";
import {
  CROSS_DOMAIN_RIVALS,
  discoverRivals,
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
    assert.ok(new QlooError("x", out.calls[0], true) instanceof QlooError);
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
});
