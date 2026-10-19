import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { getQuotaUsage, resetQuota } from "./client.ts";
import { clearControlCache, loadControlTastes } from "./control-cache.ts";

const SAVED_KEY = process.env.QLOO_API_KEY;
const SAVED_FETCH = globalThis.fetch;

function stubQloo(): { fetches: () => number } {
  process.env.QLOO_API_KEY = "test-key";
  let fetches = 0;
  globalThis.fetch = (async (input: string | URL | Request) => {
    fetches += 1;
    const url = String(input);
    if (url.includes("/search")) {
      return new Response(
        JSON.stringify({
          success: true,
          results: [{ entity_id: `e${fetches}`, name: "Seed Title" }],
        }),
        { status: 200 },
      );
    }
    const tags = Array.from({ length: 12 }, (_, i) => ({
      tag_id: `urn:tag:t${i}`,
      name: `Tag ${i}`,
    }));
    return new Response(JSON.stringify({ success: true, results: { tags } }), {
      status: 200,
    });
  }) as typeof fetch;
  return { fetches: () => fetches };
}

describe("loadControlTastes", () => {
  beforeEach(() => {
    resetQuota();
    clearControlCache();
  });

  afterEach(() => {
    if (SAVED_KEY === undefined) delete process.env.QLOO_API_KEY;
    else process.env.QLOO_API_KEY = SAVED_KEY;
    globalThis.fetch = SAVED_FETCH;
    resetQuota();
    clearControlCache();
  });

  it("miss fetches, hit serves tag sets with zero fetches", async () => {
    const counter = stubQloo();
    const first = await loadControlTastes("film", 2, 1_000);
    assert.equal(first.fromCache, false);
    assert.ok(first.controls.length > 0);
    assert.ok(first.tastes.length === first.controls.length);
    const spent = counter.fetches();
    assert.ok(spent > 0);

    resetQuota();
    const second = await loadControlTastes("film", 2, 2_000);
    assert.equal(second.fromCache, true);
    assert.equal(counter.fetches(), spent);
    assert.deepEqual(second.controls, first.controls);
    assert.deepEqual(second.tastes, first.tastes);
    assert.ok(second.calls.every((c) => c.fromCache));
    assert.deepEqual(getQuotaUsage(), { calls: 0, cached: 0 });
  });

  it("stale entries refetch after the TTL", async () => {
    const counter = stubQloo();
    const { CONTROL_CACHE_TTL_MS } = await import("./control-cache.ts");
    await loadControlTastes("film", 2, 0);
    const spent = counter.fetches();
    resetQuota();
    const again = await loadControlTastes("film", 2, CONTROL_CACHE_TTL_MS + 1);
    assert.equal(again.fromCache, false);
    assert.ok(counter.fetches() > spent);
  });

  it("keys entries by pitch type", async () => {
    stubQloo();
    const film = await loadControlTastes("film", 2, 0);
    const music = await loadControlTastes("music", 2, 0);
    assert.equal(film.fromCache, false);
    assert.equal(music.fromCache, false);
  });

  it("never caches an empty control set, so the next call retries", async () => {
    // First pass: Qloo resolves nothing (an outage, not a finding).
    let resolved = false;
    process.env.QLOO_API_KEY = "test-key";
    globalThis.fetch = (async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("/search")) {
        return new Response(
          JSON.stringify({
            success: true,
            results: resolved
              ? [{ entity_id: "seed-1", name: "Seed Title" }]
              : [],
          }),
          { status: 200 },
        );
      }
      const tags = [{ tag_id: "urn:tag:t1", name: "Tag 1" }];
      return new Response(
        JSON.stringify({ success: true, results: { tags } }),
        {
          status: 200,
        },
      );
    }) as typeof fetch;

    const empty = await loadControlTastes("film", 2, 1_000);
    assert.equal(empty.fromCache, false);
    assert.equal(empty.controls.length, 0);

    // A new run starts with a fresh request cache (`resetQuota`); only
    // the control cache could have carried the empty set across.
    resetQuota();
    resolved = true;
    const recovered = await loadControlTastes("film", 2, 1_001);
    assert.equal(recovered.fromCache, false);
    assert.ok(recovered.controls.length > 0);

    // Only the recovered measurement is cached.
    const hit = await loadControlTastes("film", 2, 1_002);
    assert.equal(hit.fromCache, true);
    assert.ok(hit.controls.length > 0);
  });

  it("never caches a wholly unmeasured taste set", async () => {
    process.env.QLOO_API_KEY = "test-key";
    let insightsFail = true;
    globalThis.fetch = (async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("/search")) {
        return new Response(
          JSON.stringify({
            success: true,
            results: [{ entity_id: "seed-1", name: "Seed Title" }],
          }),
          { status: 200 },
        );
      }
      if (insightsFail) {
        return new Response("boom", { status: 400 });
      }
      const tags = [{ tag_id: "urn:tag:t1", name: "Tag 1" }];
      return new Response(
        JSON.stringify({ success: true, results: { tags } }),
        {
          status: 200,
        },
      );
    }) as typeof fetch;

    const failed = await loadControlTastes("film", 2, 0);
    assert.equal(failed.fromCache, false);
    assert.ok(failed.tastes.every((t) => t.failed === true));

    insightsFail = false;
    const recovered = await loadControlTastes("film", 2, 1);
    assert.equal(recovered.fromCache, false);
    assert.ok(recovered.tastes.some((t) => t.failed !== true));
  });
});
