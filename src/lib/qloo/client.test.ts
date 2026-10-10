import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  getQuotaUsage,
  MAX_CALLS_PER_RUN,
  QlooError,
  QlooQuotaError,
  qlooFetch,
  resetQuota,
} from "./client.ts";

const SAVED_KEY = process.env.QLOO_API_KEY;
const SAVED_FETCH = globalThis.fetch;
const SAVED_RETRIES = process.env.QLOO_MAX_RETRIES;

function stubFetch(payload: unknown, status = 200): void {
  process.env.QLOO_API_KEY = "test-key";
  globalThis.fetch = (async () =>
    new Response(JSON.stringify(payload), { status })) as typeof fetch;
}

describe("qlooFetch cache", () => {
  beforeEach(() => {
    resetQuota();
  });

  afterEach(() => {
    if (SAVED_KEY === undefined) delete process.env.QLOO_API_KEY;
    else process.env.QLOO_API_KEY = SAVED_KEY;
    globalThis.fetch = SAVED_FETCH;
    resetQuota();
  });

  it("serves repeats from cache with fresh traces", async () => {
    stubFetch({ success: true, results: [{ entity_id: "a" }] });
    const first = await qlooFetch("/search", { query: "Moon" });
    const second = await qlooFetch("/search", { query: "Moon" });
    assert.equal(first.trace.fromCache, false);
    assert.equal(second.trace.fromCache, true);
    assert.notEqual(first.trace.id, second.trace.id);
    assert.deepEqual(second.data, first.data);
    assert.deepEqual(getQuotaUsage(), { calls: 1, cached: 1 });
  });

  it("keys cache entries by sorted params", async () => {
    stubFetch({ success: true, results: [] });
    await qlooFetch("/search", { query: "x" });
    const other = await qlooFetch("/search", { query: "y" });
    assert.equal(other.trace.fromCache, false);
    assert.deepEqual(getQuotaUsage(), { calls: 2, cached: 0 });
  });

  it("isolates callers from cached payloads", async () => {
    stubFetch({ success: true, results: [{ entity_id: "a" }] });
    const first = await qlooFetch("/search", { query: "Moon" });
    (first.data as { results: unknown[] }).results.push("poison");
    const second = await qlooFetch("/search", { query: "Moon" });
    assert.deepEqual((second.data as { results: unknown[] }).results, [
      { entity_id: "a" },
    ]);
  });

  it("resetQuota zeroes counters and drops entries", async () => {
    stubFetch({ success: true, results: [] });
    await qlooFetch("/search", { query: "x" });
    await qlooFetch("/search", { query: "x" });
    resetQuota();
    assert.deepEqual(getQuotaUsage(), { calls: 0, cached: 0 });
    const after = await qlooFetch("/search", { query: "x" });
    assert.equal(after.trace.fromCache, false);
  });
});

describe("qlooFetch legacy compatibility", () => {
  beforeEach(() => resetQuota());

  afterEach(() => {
    if (SAVED_KEY === undefined) delete process.env.QLOO_API_KEY;
    else process.env.QLOO_API_KEY = SAVED_KEY;
    if (SAVED_RETRIES === undefined) delete process.env.QLOO_MAX_RETRIES;
    else process.env.QLOO_MAX_RETRIES = SAVED_RETRIES;
    globalThis.fetch = SAVED_FETCH;
    resetQuota();
  });

  it("retains no-key mock responses without an HTTP request", async () => {
    delete process.env.QLOO_API_KEY;
    globalThis.fetch = (async () => {
      throw new Error("Legacy mock mode must not fetch.");
    }) as typeof fetch;
    const out = await qlooFetch("/search", { query: "Offline" });
    assert.deepEqual(out.data, { success: true, mock: true, results: [] });
    assert.equal(out.trace.fromCache, true);
    assert.deepEqual(getQuotaUsage(), { calls: 0, cached: 0 });
  });

  it("preserves legacy invocation-based retry accounting", async () => {
    process.env.QLOO_API_KEY = "test-key";
    process.env.QLOO_MAX_RETRIES = "1";
    let fetches = 0;
    globalThis.fetch = (async () => {
      fetches += 1;
      return new Response(JSON.stringify({ results: [] }), {
        status: fetches === 1 ? 503 : 200,
      });
    }) as typeof fetch;
    const out = await qlooFetch("/search", { query: "Retry" });
    assert.equal(out.trace.status, 200);
    assert.equal(fetches, 2);
    assert.deepEqual(getQuotaUsage(), { calls: 1, cached: 0 });
  });
});

describe("qlooFetch quota", () => {
  beforeEach(() => {
    resetQuota();
  });

  afterEach(() => {
    if (SAVED_KEY === undefined) delete process.env.QLOO_API_KEY;
    else process.env.QLOO_API_KEY = SAVED_KEY;
    globalThis.fetch = SAVED_FETCH;
    resetQuota();
  });

  it("throws a non-QlooError breach past the cap, never a fake not-found", async () => {
    stubFetch({ success: true, results: [] });
    for (let i = 0; i < MAX_CALLS_PER_RUN; i += 1) {
      await qlooFetch("/search", { query: `q${i}` });
    }
    await assert.rejects(
      () => qlooFetch("/search", { query: "over" }),
      (err) => {
        assert.ok(err instanceof QlooQuotaError);
        // Critical: never a QlooError, so callers cannot degrade a quota
        // blowout into fake not-found/no-data.
        assert.ok(!(err instanceof QlooError));
        assert.match((err as Error).message, /quota exceeded/);
        assert.equal((err as QlooQuotaError).usage.calls, MAX_CALLS_PER_RUN);
        return true;
      },
    );
  });
});
