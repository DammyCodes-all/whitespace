/**
 * suggestFromEntities: entity-seeded names + self-exclusion + cap,
 * empty on failure. Mocks only: a synthetic key with a stubbed
 * transport, so no request ever leaves the process and no real key
 * is read.
 */

import assert from "node:assert/strict";
import type { TestContext } from "node:test";
import { describe, it } from "node:test";
import { resetQuota } from "./client.ts";
import { MAX_RELATED_TITLES, suggestFromEntities } from "./related-titles.ts";

const SAVED_KEY = process.env.QLOO_API_KEY;
const SAVED_FETCH = globalThis.fetch;

/** Synthetic key plus a /v2/insights stub returning canned entities. */
function stubInsights(
  t: TestContext,
  entities: unknown[],
  onParams?: (params: URLSearchParams) => void,
): void {
  process.env.QLOO_API_KEY = "synthetic-test-key";
  resetQuota();
  t.mock.method(globalThis, "fetch", (async (input: unknown) => {
    const url = new URL(String(input));
    onParams?.(url.searchParams);
    return new Response(
      JSON.stringify({ success: true, results: { entities } }),
      { status: 200 },
    );
  }) as typeof fetch);
  t.after(() => {
    if (SAVED_KEY === undefined) delete process.env.QLOO_API_KEY;
    else process.env.QLOO_API_KEY = SAVED_KEY;
    globalThis.fetch = SAVED_FETCH;
    resetQuota();
  });
}

function stubFailure(t: TestContext): void {
  process.env.QLOO_API_KEY = "synthetic-test-key";
  resetQuota();
  t.mock.method(globalThis, "fetch", (async () => {
    return new Response("boom", { status: 500 });
  }) as typeof fetch);
  t.after(() => {
    if (SAVED_KEY === undefined) delete process.env.QLOO_API_KEY;
    else process.env.QLOO_API_KEY = SAVED_KEY;
    globalThis.fetch = SAVED_FETCH;
    resetQuota();
  });
}

describe("suggestFromEntities", () => {
  it("extracts names, excludes typed titles, and caps at 5", async (t) => {
    stubInsights(t, [
      { entity_id: "a", name: "Parasyte" },
      { entity_id: "b", name: "parasyte" },
      { entity_id: "c", name: "Tokyo Ghoul" },
      { entity_id: "d", name: "" },
      { entity_id: "e", name: "The Fly" },
      { entity_id: "f", name: "Akira" },
      { entity_id: "g", name: " Tetsuo " },
      { entity_id: "h", name: "Uzumaki" },
    ]);
    const out = await suggestFromEntities(["id1"], ["Parasyte"], "film");
    assert.deepEqual(out.names, [
      "Tokyo Ghoul",
      "The Fly",
      "Akira",
      "Tetsuo",
      "Uzumaki",
    ]);
    assert.equal(out.names.length, MAX_RELATED_TITLES);
  });

  it("sends the own-domain filter type with up to 5 entity ids", async (t) => {
    let seen = "";
    let signal = "";
    let take = "";
    stubInsights(t, [], (params) => {
      seen = params.get("filter.type") ?? "";
      signal = params.get("signal.interests.entities") ?? "";
      take = params.get("take") ?? "";
    });
    const ids = Array.from({ length: 7 }, (_, i) => `id${i}`);
    await suggestFromEntities(ids, [], "film");
    assert.equal(seen, "urn:entity:movie");
    assert.equal(signal, ids.slice(0, 5).join(","));
    assert.equal(take, "10");
  });

  it("returns empty on Qloo failure instead of throwing", async (t) => {
    stubFailure(t);
    const out = await suggestFromEntities(["id1"], [], "film");
    assert.deepEqual(out, { names: [] });
  });

  it("returns empty on blank names and on no entity ids", async (t) => {
    stubInsights(t, [{ entity_id: "a", name: "   " }, { entity_id: "b" }]);
    assert.deepEqual((await suggestFromEntities(["id1"], [], "book")).names, []);
    assert.deepEqual((await suggestFromEntities([], [], "film")).names, []);
    assert.deepEqual((await suggestFromEntities(["  "], [], "film")).names, []);
  });
});
