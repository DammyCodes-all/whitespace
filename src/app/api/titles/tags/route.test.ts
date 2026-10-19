/**
 * POST /api/titles/tags: validation plus the title-tag preview.
 * Mocks only: a synthetic key with a stubbed transport, so no request
 * ever leaves the process and no real key is read.
 */

import assert from "node:assert/strict";
import type { TestContext } from "node:test";
import { describe, it } from "node:test";
import { resetQuota } from "../../../../lib/qloo/client.ts";
import { clearControlCache } from "../../../../lib/qloo/control-cache.ts";
import { POST } from "./route.ts";

const SAVED_KEY = process.env.QLOO_API_KEY;
const SAVED_GROQ = process.env.GROQ_API_KEY;
const SAVED_ROUTER = process.env.OPENROUTER_API_KEY;
const SAVED_FETCH = globalThis.fetch;
const SAVED_RETRIES = process.env.QLOO_MAX_RETRIES;

/** Synthetic key plus a stub: "Moon" resolves; tag insights serve f-tags. */
function stubQloo(
  t: TestContext,
  options: { moonTags?: string[]; genericMoon?: boolean } = {},
): void {
  process.env.QLOO_API_KEY = "synthetic-test-key";
  delete process.env.GROQ_API_KEY;
  delete process.env.OPENROUTER_API_KEY;
  resetQuota();
  clearControlCache();
  const ids = (names: string[]) =>
    names.map((id) => ({ tag_id: id, name: `name-of-${id}` }));
  // Moon's tastes: 15 tags, so the preview takes the top 12.
  const moonTags =
    options.moonTags ??
    Array.from({ length: 15 }, (_, i) => `urn:tag:moon${i}`);
  // Control tastes hold none of Moon's tags (no generic cut) — unless
  // genericMoon, which puts every Moon tag in every control list.
  const controlTags = options.genericMoon
    ? [...moonTags, ...Array.from({ length: 40 }, (_, i) => `urn:tag:ctl${i}`)]
    : Array.from({ length: 50 }, (_, i) => `urn:tag:ctl${i}`);
  t.mock.method(globalThis, "fetch", (async (input: unknown) => {
    const url = new URL(String(input));
    if (url.pathname === "/search") {
      const query = url.searchParams.get("query") ?? "";
      if (query === "Missing Title") {
        return new Response(JSON.stringify({ success: true, results: [] }), {
          status: 200,
        });
      }
      const hit =
        query === "Moon"
          ? { entity_id: "moon-id", name: "Moon", type: "urn:entity:movie" }
          : { entity_id: `id:${query}`, name: query, type: "urn:entity:movie" };
      return new Response(JSON.stringify({ success: true, results: [hit] }), {
        status: 200,
      });
    }
    const filterType = url.searchParams.get("filter.type") ?? "";
    if (filterType === "urn:tag") {
      const entities = url.searchParams.get("signal.interests.entities") ?? "";
      const tags = entities.includes("moon-id") ? moonTags : controlTags;
      return new Response(
        JSON.stringify({ success: true, results: { tags: ids(tags) } }),
        { status: 200 },
      );
    }
    return new Response(JSON.stringify({ success: true, results: [] }), {
      status: 200,
    });
  }) as typeof fetch);
  t.after(() => {
    if (SAVED_KEY === undefined) delete process.env.QLOO_API_KEY;
    else process.env.QLOO_API_KEY = SAVED_KEY;
    if (SAVED_GROQ === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = SAVED_GROQ;
    if (SAVED_ROUTER === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = SAVED_ROUTER;
    globalThis.fetch = SAVED_FETCH;
    resetQuota();
    clearControlCache();
  });
}

function post(body: unknown): Request {
  return new Request("http://localhost/api/titles/tags", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

interface PreviewTag {
  qlooId: string;
  label: string;
  sourceTitleId: string | null;
  sourceTitleName: string | null;
}

describe("POST /api/titles/tags", () => {
  it("400s on an invalid workType", async (t) => {
    stubQloo(t);
    const res = await POST(post({ titles: ["Moon"], workType: "poem" }));
    assert.equal(res.status, 400);
  });

  it("400s when titles are missing", async (t) => {
    stubQloo(t);
    const res = await POST(post({ titles: [], workType: "film" }));
    assert.equal(res.status, 400);
  });

  it("returns the top-12 title gifts with provenance, no pitch tags", async (t) => {
    stubQloo(t);
    const res = await POST(post({ titles: ["Moon"], workType: "film" }));
    assert.equal(res.status, 200);
    const data = (await res.json()) as { tags?: PreviewTag[]; note?: string };
    assert.ok(Array.isArray(data.tags));
    assert.equal(data.tags?.length, 12);
    assert.equal(data.note, "ok");
    assert.equal((data as { quota?: string }).quota, "ok");
    assert.ok(
      (data.tags ?? []).every(
        (tag) =>
          tag.sourceTitleId === "moon-id" &&
          tag.sourceTitleName === "Moon" &&
          tag.label === `name-of-${tag.qlooId}`,
      ),
    );
    assert.equal(data.tags?.[0]?.qlooId, "urn:tag:moon0");
  });

  it("returns 429 with a quota state instead of an unresolved preview", async (t) => {
    process.env.QLOO_API_KEY = "synthetic-test-key";
    process.env.QLOO_MAX_RETRIES = "0";
    resetQuota();
    clearControlCache();
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
      clearControlCache();
    });
    const res = await POST(post({ titles: ["Moon"], workType: "film" }));
    assert.equal(res.status, 429);
    assert.equal(res.headers.get("Retry-After"), "30");
    const data = (await res.json()) as {
      error?: string;
      quota?: string;
      note?: unknown;
      tags?: unknown;
    };
    assert.equal(data.quota, "rate-limited");
    assert.ok(data.error);
    // Not a title that failed to resolve, and not a vague preview failure.
    assert.equal(data.note, undefined);
    assert.equal(data.tags, undefined);
  });

  it("returns an empty list when nothing resolves", async (t) => {
    stubQloo(t);
    const res = await POST(
      post({ titles: ["Missing Title"], workType: "film" }),
    );
    assert.equal(res.status, 200);
    const data = (await res.json()) as { tags?: PreviewTag[]; note?: string };
    assert.deepEqual(data.tags, []);
    assert.equal(data.note, "unresolved");
  });

  it("says no-tastes when Qloo holds no tastes for the titles", async (t) => {
    stubQloo(t, { moonTags: [] });
    const res = await POST(post({ titles: ["Moon"], workType: "film" }));
    assert.equal(res.status, 200);
    const data = (await res.json()) as { tags?: PreviewTag[]; note?: string };
    assert.deepEqual(data.tags, []);
    assert.equal(data.note, "no-tastes");
  });

  it("says all-generic when the generic cut eats every gift", async (t) => {
    stubQloo(t, { genericMoon: true });
    const res = await POST(post({ titles: ["Moon"], workType: "film" }));
    assert.equal(res.status, 200);
    const data = (await res.json()) as { tags?: PreviewTag[]; note?: string };
    assert.deepEqual(data.tags, []);
    assert.equal(data.note, "all-generic");
  });

  it("says unresolved when the transport throws on every call", async (t) => {
    process.env.QLOO_API_KEY = "synthetic-test-key";
    resetQuota();
    clearControlCache();
    t.mock.method(globalThis, "fetch", (async () => {
      throw new TypeError("network down");
    }) as typeof fetch);
    t.after(() => {
      if (SAVED_KEY === undefined) delete process.env.QLOO_API_KEY;
      else process.env.QLOO_API_KEY = SAVED_KEY;
      globalThis.fetch = SAVED_FETCH;
      resetQuota();
      clearControlCache();
    });
    const res = await POST(post({ titles: ["Moon"], workType: "film" }));
    assert.equal(res.status, 200);
    const data = (await res.json()) as { tags?: PreviewTag[]; note?: string };
    assert.deepEqual(data.tags, []);
    // Per-title resolve degrades to not-found, so nothing resolves.
    assert.equal(data.note, "unresolved");
  });
});
