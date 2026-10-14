/**
 * suggestTitles: name extraction + dedupe + cap, empty on failure.
 * Mocks only: a synthetic key with a stubbed transport, so no request
 * ever leaves the process and no real key is read.
 */

import assert from "node:assert/strict";
import type { TestContext } from "node:test";
import { describe, it } from "node:test";
import { resetQuota } from "./client.ts";
import { MAX_SUGGESTED_TITLES, suggestTitles } from "./suggest-titles.ts";

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

describe("suggestTitles", () => {
  it("extracts names, dedupes case variants, and caps at 5", async (t) => {
    stubInsights(t, [
      { entity_id: "a", name: " Dune " },
      { entity_id: "b", name: "dune" },
      { entity_id: "c", name: "" },
      { entity_id: "d", name: "  " },
      { entity_id: "e", name: 42 },
      { entity_id: "f", name: "Arrival" },
      { entity_id: "g", name: "Moon" },
      { entity_id: "h", name: "Blade Runner 2049" },
      { entity_id: "i", name: "Interstellar" },
      { entity_id: "j", name: "The Matrix" },
      { entity_id: "k", name: "Ghost in the Shell" },
    ]);
    const out = await suggestTitles(["tag1", "tag2"], "film");
    assert.deepEqual(out.names, [
      "Dune",
      "Arrival",
      "Moon",
      "Blade Runner 2049",
      "Interstellar",
    ]);
    assert.equal(out.names.length, MAX_SUGGESTED_TITLES);
  });

  it("sends the own-domain filter type with up to 8 tag ids", async (t) => {
    let seen = "";
    let signal = "";
    let take = "";
    stubInsights(t, [], (params) => {
      seen = params.get("filter.type") ?? "";
      signal = params.get("signal.interests.tags") ?? "";
      take = params.get("take") ?? "";
    });
    const ids = Array.from({ length: 10 }, (_, i) => `tag${i}`);
    await suggestTitles(ids, "film");
    assert.equal(seen, "urn:entity:movie");
    assert.equal(signal, ids.slice(0, 8).join(","));
    assert.equal(take, "10");
  });

  it("returns empty on Qloo failure instead of throwing", async (t) => {
    stubFailure(t);
    const out = await suggestTitles(["tag1"], "film");
    assert.deepEqual(out, { names: [] });
  });

  it("returns empty on blank names and on no tag ids", async (t) => {
    stubInsights(t, [{ entity_id: "a", name: "   " }, { entity_id: "b" }]);
    assert.deepEqual((await suggestTitles(["tag1"], "book")).names, []);
    // No ids: no signal to send, so no fetch and no names.
    assert.deepEqual((await suggestTitles([], "film")).names, []);
    assert.deepEqual((await suggestTitles(["  "], "film")).names, []);
  });
});
