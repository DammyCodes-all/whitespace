/**
 * POST /api/titles/check: validation plus resolved/notFound mapping.
 * Mocks only: a synthetic key with a stubbed transport, so no request
 * ever leaves the process and no real key is read.
 */

import assert from "node:assert/strict";
import type { TestContext } from "node:test";
import { describe, it } from "node:test";
import { resetQuota } from "../../../../lib/qloo/client.ts";
import { MAX_TITLE_QUERIES } from "../../../../lib/qloo/resolve-titles.ts";
import { POST } from "./route.ts";

const SAVED_KEY = process.env.QLOO_API_KEY;
const SAVED_FETCH = globalThis.fetch;
const SAVED_RETRIES = process.env.QLOO_MAX_RETRIES;

/** Synthetic key plus a /search stub: only "Moon" resolves. */
function stubSearch(t: TestContext): { calls: number } {
  const state = { calls: 0 };
  process.env.QLOO_API_KEY = "synthetic-test-key";
  resetQuota();
  t.mock.method(globalThis, "fetch", (async (input: unknown) => {
    state.calls += 1;
    const url = new URL(String(input));
    const query = url.searchParams.get("query") ?? "";
    const results =
      query === "Moon"
        ? [{ entity_id: "moon-id", name: "Moon", type: "urn:entity:movie" }]
        : [];
    return new Response(JSON.stringify({ success: true, results }), {
      status: 200,
    });
  }) as typeof fetch);
  t.after(() => {
    if (SAVED_KEY === undefined) delete process.env.QLOO_API_KEY;
    else process.env.QLOO_API_KEY = SAVED_KEY;
    globalThis.fetch = SAVED_FETCH;
    resetQuota();
  });
  return state;
}

function post(body: unknown): Request {
  return new Request("http://localhost/api/titles/check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

/** Synthetic key plus a /search stub that always answers 429. */
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

describe("POST /api/titles/check", () => {
  it("400s on an invalid workType", async (t) => {
    stubSearch(t);
    const res = await POST(post({ titles: ["Moon"], workType: "poem" }));
    assert.equal(res.status, 400);
    const data = (await res.json()) as { error?: string };
    assert.match(data.error ?? "", /workType/);
  });

  it("400s when titles are missing or blank", async (t) => {
    stubSearch(t);
    for (const body of [
      { titles: [], workType: "film" },
      { titles: ["   "], workType: "film" },
      { workType: "film" },
    ]) {
      const res = await POST(post(body));
      assert.equal(res.status, 400);
    }
  });

  it("400s on invalid JSON", async (t) => {
    stubSearch(t);
    const res = await POST(post("not json{"));
    assert.equal(res.status, 400);
  });

  it("maps resolved and notFound without leaking keys", async (t) => {
    stubSearch(t);
    const res = await POST(
      post({ titles: ["Moon", "No Such Title XYZ"], workType: "film" }),
    );
    assert.equal(res.status, 200);
    const data = (await res.json()) as {
      resolved?: { query: string; name: string; qlooId: string }[];
      notFound?: string[];
    };
    assert.deepEqual(data.resolved, [
      { query: "Moon", name: "Moon", qlooId: "moon-id" },
    ]);
    assert.deepEqual(data.notFound, ["No Such Title XYZ"]);
    assert.equal((data as { quota?: string }).quota, "ok");
    assert.ok(!JSON.stringify(data).includes("synthetic-test-key"));
  });

  it("returns 429 with a quota state instead of a fake not-found", async (t) => {
    stubRateLimit(t);
    const res = await POST(post({ titles: ["Moon"], workType: "film" }));
    assert.equal(res.status, 429);
    assert.equal(res.headers.get("Retry-After"), "30");
    const data = (await res.json()) as {
      error?: string;
      quota?: string;
      retryAfterMs?: number;
      resolved?: unknown;
      notFound?: unknown;
    };
    assert.equal(data.quota, "rate-limited");
    assert.equal(data.retryAfterMs, 30_000);
    assert.ok(data.error);
    // The title was never looked up; it must not be reported as missing.
    assert.equal(data.notFound, undefined);
    assert.equal(data.resolved, undefined);
  });

  it("caps search calls at MAX_TITLE_QUERIES", async (t) => {
    const state = stubSearch(t);
    const titles = Array.from({ length: 12 }, (_, i) => `Missing ${i}`);
    const res = await POST(post({ titles, workType: "film" }));
    assert.equal(res.status, 200);
    assert.equal(state.calls, MAX_TITLE_QUERIES);
    const data = (await res.json()) as { notFound?: string[] };
    assert.equal(data.notFound?.length, MAX_TITLE_QUERIES);
  });
});
