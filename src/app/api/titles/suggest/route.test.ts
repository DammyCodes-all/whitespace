/**
 * POST /api/titles/suggest: validation, name mapping, empty-on-failure.
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
  return new Request("http://localhost/api/titles/suggest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/titles/suggest", () => {
  it("400s on an invalid workType", async (t) => {
    stubInsights(t, []);
    const res = await POST(post({ tagIds: ["tag1"], workType: "poem" }));
    assert.equal(res.status, 400);
    const data = (await res.json()) as { error?: string };
    assert.match(data.error ?? "", /workType/);
  });

  it("400s when tagIds are missing or blank", async (t) => {
    stubInsights(t, []);
    for (const body of [
      { tagIds: [], workType: "film" },
      { tagIds: ["   "], workType: "film" },
      { workType: "film" },
    ]) {
      const res = await POST(post(body));
      assert.equal(res.status, 400);
    }
  });

  it("maps insight entities to suggestion names", async (t) => {
    stubInsights(t, [
      { entity_id: "a", name: "Dune" },
      { entity_id: "b", name: "dune" },
      { entity_id: "c", name: "Arrival" },
    ]);
    const res = await POST(
      post({ tagIds: ["tag1", "tag2"], workType: "film" }),
    );
    assert.equal(res.status, 200);
    const data = (await res.json()) as { suggestions?: string[] };
    assert.deepEqual(data.suggestions, ["Dune", "Arrival"]);
  });

  it("returns 200 with an empty list on Qloo failure", async (t) => {
    stubFailure(t);
    const res = await POST(post({ tagIds: ["tag1"], workType: "film" }));
    assert.equal(res.status, 200);
    const data = (await res.json()) as { suggestions?: string[] };
    assert.deepEqual(data.suggestions, []);
  });
});
