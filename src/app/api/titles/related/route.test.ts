/**
 * POST /api/titles/related: validation, name mapping, empty-on-failure.
 * Mocks only: a synthetic key with a stubbed transport, so no request
 * ever leaves the process and no real key is read.
 */

import assert from "node:assert/strict";
import type { TestContext } from "node:test";
import { describe, it } from "node:test";
import { resetQuota } from "../../../../lib/qloo/client.ts";
import { POST } from "./route.ts";

const SAVED_KEY = process.env.QLOO_API_KEY;
const SAVED_FETCH = globalThis.fetch;
const SAVED_RETRIES = process.env.QLOO_MAX_RETRIES;

/** Synthetic key plus a /v2/insights stub returning canned entities. */
function stubInsights(t: TestContext, entities: unknown[]): void {
  process.env.QLOO_API_KEY = "synthetic-test-key";
  resetQuota();
  t.mock.method(globalThis, "fetch", (async () => {
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

function post(body: unknown): Request {
  return new Request("http://localhost/api/titles/related", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

/** Synthetic key plus a /v2/insights stub that always answers 429. */
function stubRateLimit(t: TestContext): void {
  process.env.QLOO_API_KEY = "synthetic-test-key";
  process.env.QLOO_MAX_RETRIES = "0";
  resetQuota();
  globalThis.fetch = (async () =>
    new Response("slow down", {
      status: 429,
      headers: { "Retry-After": "30" },
    })) as typeof fetch;
  t.after(() => {
    if (SAVED_KEY === undefined) delete process.env.QLOO_API_KEY;
    else process.env.QLOO_API_KEY = SAVED_KEY;
    if (SAVED_RETRIES === undefined) delete process.env.QLOO_MAX_RETRIES;
    else process.env.QLOO_MAX_RETRIES = SAVED_RETRIES;
    globalThis.fetch = SAVED_FETCH;
    resetQuota();
  });
}

describe("POST /api/titles/related", () => {
  it("400s on an invalid workType", async (t) => {
    stubInsights(t, []);
    const res = await POST(post({ entityIds: ["id1"], workType: "poem" }));
    assert.equal(res.status, 400);
    const data = (await res.json()) as { error?: string };
    assert.match(data.error ?? "", /workType/);
  });

  it("400s when entityIds are missing or blank", async (t) => {
    stubInsights(t, []);
    for (const body of [
      { entityIds: [], workType: "film" },
      { entityIds: ["   "], workType: "film" },
      { workType: "film" },
    ]) {
      const res = await POST(post(body));
      assert.equal(res.status, 400);
    }
  });

  it("maps insight entities to suggestion names minus typed titles", async (t) => {
    stubInsights(t, [
      { entity_id: "a", name: "Parasyte" },
      { entity_id: "b", name: "Tokyo Ghoul" },
      { entity_id: "c", name: "The Fly" },
    ]);
    const res = await POST(
      post({
        entityIds: ["id1"],
        excludeNames: ["Parasyte"],
        workType: "film",
      }),
    );
    assert.equal(res.status, 200);
    const data = (await res.json()) as {
      suggestions?: string[];
      quota?: string;
    };
    assert.deepEqual(data.suggestions, ["Tokyo Ghoul", "The Fly"]);
    assert.equal(data.quota, "ok");
  });

  it("returns 429 with a quota state instead of no suggestions", async (t) => {
    stubRateLimit(t);
    const res = await POST(post({ entityIds: ["id1"], workType: "film" }));
    assert.equal(res.status, 429);
    assert.equal(res.headers.get("Retry-After"), "30");
    const data = (await res.json()) as {
      error?: string;
      quota?: string;
      retryAfterMs?: number;
      suggestions?: unknown;
    };
    assert.equal(data.quota, "rate-limited");
    assert.equal(data.retryAfterMs, 30_000);
    assert.ok(data.error);
    assert.equal(data.suggestions, undefined);
  });

  it("returns 200 with an empty list on Qloo failure", async (t) => {
    stubFailure(t);
    const res = await POST(post({ entityIds: ["id1"], workType: "film" }));
    assert.equal(res.status, 200);
    const data = (await res.json()) as { suggestions?: string[] };
    assert.deepEqual(data.suggestions, []);
  });
});
