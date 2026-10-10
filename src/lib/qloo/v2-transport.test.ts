import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  getQuotaUsage,
  MAX_CALLS_PER_RUN,
  QlooError,
  QlooQuotaError,
  type QlooRequestContext,
  qlooFetch,
  resetQuota,
} from "./client.ts";
import {
  fetchV2DiscoveryCategory,
  fetchV2DiscoveryLens,
} from "./v2-evidence.ts";
import { resolveV2Reference, type V2Budget } from "./v2-identity.ts";
import { fetchV2ReachCategory } from "./v2-reach.ts";

const envNames = [
  "QLOO_API_KEY",
  "QLOO_BASE_URL",
  "QLOO_TIMEOUT_MS",
  "QLOO_MAX_RETRIES",
] as const;
const savedEnv = new Map(envNames.map((name) => [name, process.env[name]]));
const savedFetch = globalThis.fetch;
const movie = "urn:entity:movie";
const artist = "urn:entity:artist";
const podcast = "urn:entity:podcast";

function context(ceiling = 40, signal?: AbortSignal): V2Budget {
  return { used: 0, ceiling, calls: [], signal };
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status });
}

function search(name = "Reference") {
  return { results: [{ entity_id: "R1", name, type: movie }] };
}

function insights() {
  return {
    results: {
      entities: [
        { entity_id: "C1", name: "Connected Work", type: artist, tags: ["t1"] },
      ],
    },
  };
}

describe("v2 request-scoped Qloo transport", () => {
  beforeEach(() => {
    resetQuota();
    process.env.QLOO_API_KEY = "test-key";
    process.env.QLOO_BASE_URL = "https://qloo.invalid";
    process.env.QLOO_TIMEOUT_MS = "80";
    process.env.QLOO_MAX_RETRIES = "2";
    globalThis.fetch = (async () => {
      throw new Error("Every test must mock fetch; no live API calls allowed.");
    }) as typeof fetch;
  });

  afterEach(() => {
    for (const name of envNames) {
      const value = savedEnv.get(name);
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    globalThis.fetch = savedFetch;
    resetQuota();
  });

  it("resolves 151 fresh contexts without inheriting the legacy quota", async () => {
    let fetches = 0;
    globalThis.fetch = (async (url) => {
      fetches += 1;
      return json(search(new URL(String(url)).searchParams.get("query") ?? ""));
    }) as typeof fetch;
    for (let i = 0; i < 151; i += 1) {
      const budget = context(1);
      const out = await resolveV2Reference(`Reference ${i}`, movie, budget);
      assert.equal(out.state, "resolved", `fresh context ${i}`);
      assert.equal(budget.used, 1);
    }
    assert.equal(fetches, 151);
    assert.deepEqual(getQuotaUsage(), { calls: 0, cached: 0 });
  });

  it("bypasses both exhausted legacy quota and legacy cached data", async () => {
    let fetches = 0;
    globalThis.fetch = (async () => {
      fetches += 1;
      return json(search());
    }) as typeof fetch;
    const params = { query: "Reference", types: movie, take: "5" };
    await qlooFetch("/search", params);
    for (let i = 1; i < MAX_CALLS_PER_RUN; i += 1) {
      await qlooFetch("/search", { query: `legacy-${i}` });
    }
    const budget = context(1);
    const out = await resolveV2Reference("Reference", movie, budget);
    assert.equal(out.state, "resolved");
    assert.equal(fetches, MAX_CALLS_PER_RUN + 1);
    assert.equal(budget.calls?.[0].fromCache, false);
    assert.deepEqual(getQuotaUsage(), { calls: MAX_CALLS_PER_RUN, cached: 0 });
  });

  it("charges the first 503 and refuses a retry at ceiling 1", async () => {
    let fetches = 0;
    globalThis.fetch = (async () => {
      fetches += 1;
      return json({ error: "synthetic outage" }, fetches < 3 ? 503 : 200);
    }) as typeof fetch;
    const budget = context(1);
    const out = await resolveV2Reference("Reference", movie, budget);
    assert.equal(out.state, "request_failed");
    assert.equal(fetches, 1);
    assert.equal(budget.used, 1);
    assert.match(out.provenance, /budget exhausted/);
    assert.equal(out.callId, budget.calls?.[0].id);
    assert.equal(budget.calls?.[0].attempts, 1);
    assert.equal(budget.calls?.[0].status, 503);
    assert.deepEqual(budget.calls?.[0].response, { error: "synthetic outage" });
  });

  it("charges retries and records one logical call with its final response", async () => {
    let fetches = 0;
    globalThis.fetch = (async () => {
      fetches += 1;
      return fetches === 1 ? json({ error: "busy" }, 503) : json(search());
    }) as typeof fetch;
    const budget = context(2);
    const out = await resolveV2Reference("Reference", movie, budget);
    assert.equal(out.state, "resolved");
    assert.equal(fetches, 2);
    assert.equal(budget.used, 2);
    assert.equal(budget.calls?.length, 1);
    assert.equal(budget.calls?.[0].attempts, 2);
    assert.deepEqual(budget.calls?.[0].response, search());
    assert.equal(out.callId, budget.calls?.[0].id);
  });

  it("serves isolated, cloned cache hits even after the request ceiling is spent", async () => {
    let fetches = 0;
    globalThis.fetch = (async () => {
      fetches += 1;
      return json(search());
    }) as typeof fetch;
    const budget = context(1);
    const first = await resolveV2Reference("Reference", movie, budget);
    assert.equal(first.state, "resolved");
    resetQuota();
    const second = await resolveV2Reference("Reference", movie, budget);
    assert.equal(second.state, "resolved");
    assert.equal(budget.used, 1);
    assert.equal(fetches, 1);
    assert.notEqual(first.callId, second.callId);
    assert.equal(budget.calls?.[1].fromCache, true);
    assert.equal(budget.calls?.[1].attempts, 0);
    assert.equal(budget.calls?.[1].id, second.callId);
    assert.deepEqual(getQuotaUsage(), { calls: 0, cached: 0 });

    const fresh = context(1);
    await resolveV2Reference("Reference", movie, fresh);
    assert.equal(fetches, 2);
    assert.equal(fresh.used, 1);
    assert.equal(fresh.calls?.[0].fromCache, false);

    const direct: QlooRequestContext = context(1);
    const params = { query: "Clone" };
    const original = await qlooFetch("/search", params, direct);
    (original.data as { results: unknown[] }).results.push("poison");
    if (direct.calls) direct.calls[0].response = "also poison";
    params.query = "changed";
    const cached = await qlooFetch("/search", { query: "Clone" }, direct);
    assert.deepEqual(cached.data, search());
    assert.equal(original.trace.params.query, "Clone");
    assert.equal(direct.calls?.[1].params.query, "Clone");
  });

  it("keeps concurrent context budgets, ledgers and caches independent", async () => {
    let fetches = 0;
    globalThis.fetch = (async () => {
      fetches += 1;
      await Promise.resolve();
      return json(search());
    }) as typeof fetch;
    const a = context(1);
    const b = context(1);
    const outcomes = await Promise.all([
      resolveV2Reference("Reference", movie, a),
      resolveV2Reference("Reference", movie, b),
    ]);
    assert.deepEqual(
      outcomes.map((out) => out.state),
      ["resolved", "resolved"],
    );
    assert.equal(fetches, 2);
    assert.equal(a.used, 1);
    assert.equal(b.used, 1);
    assert.equal(a.calls?.length, 1);
    assert.equal(b.calls?.length, 1);
    assert.notEqual(a.calls?.[0].id, b.calls?.[0].id);
  });

  it("enforces a shared attempt ceiling during concurrent category retrieval", async () => {
    let fetches = 0;
    globalThis.fetch = (async () => {
      fetches += 1;
      return json(insights());
    }) as typeof fetch;
    const budget = context(1);
    const outcomes = await fetchV2DiscoveryLens("R1", "a1", [], budget);
    assert.deepEqual(
      outcomes.map((out) => out.status),
      ["ok", "failed"],
    );
    assert.equal(fetches, 1);
    assert.equal(budget.used, 1);
    assert.equal(budget.calls?.length, 2);
    const failure = budget.calls?.find(
      (call) => call.id === outcomes[1].callId,
    );
    assert.ok(failure);
    assert.equal(failure.attempts, 0);
    assert.match(outcomes[1].queryProvenance, /budget exhausted/);
  });

  it("propagates cancellation into in-flight fetch and never retries", async () => {
    const controller = new AbortController();
    const budget = context(40, controller.signal);
    let fetches = 0;
    let requestSignal: AbortSignal | undefined;
    globalThis.fetch = ((_url, init) => {
      fetches += 1;
      requestSignal = init?.signal ?? undefined;
      return new Promise<Response>((_resolve, reject) => {
        requestSignal?.addEventListener(
          "abort",
          () => {
            reject(new DOMException("aborted", "AbortError"));
          },
          { once: true },
        );
      });
    }) as typeof fetch;
    const pending = resolveV2Reference("Reference", movie, budget);
    controller.abort();
    const out = await pending;
    assert.equal(out.state, "request_failed");
    assert.equal(requestSignal?.aborted, true);
    assert.equal(fetches, 1);
    assert.equal(budget.used, 1);
    assert.match(out.provenance, /cancelled/);
    assert.match(budget.calls?.[0].error ?? "", /cancelled/);
  });

  it("keeps cancellation active while reading the provider response body", async () => {
    const controller = new AbortController();
    const budget = context(40, controller.signal);
    let reading!: () => void;
    const bodyStarted = new Promise<void>((resolve) => {
      reading = resolve;
    });
    globalThis.fetch = (async (_url, init) =>
      new Response(
        new ReadableStream({
          start(stream) {
            init?.signal?.addEventListener(
              "abort",
              () => {
                stream.error(new DOMException("aborted", "AbortError"));
              },
              { once: true },
            );
            reading();
          },
        }),
        { status: 200 },
      )) as typeof fetch;
    const pending = resolveV2Reference("Reference", movie, budget);
    await bodyStarted;
    controller.abort();
    const out = await pending;
    assert.equal(out.state, "request_failed");
    assert.equal(budget.used, 1);
    assert.match(out.error ?? "", /cancelled/);
    assert.equal(budget.calls?.[0].attempts, 1);
  });

  it("reports provider timeouts separately from run cancellation", async () => {
    process.env.QLOO_TIMEOUT_MS = "5";
    process.env.QLOO_MAX_RETRIES = "0";
    globalThis.fetch = ((_url, init) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => {
            reject(new DOMException("aborted", "AbortError"));
          },
          { once: true },
        );
      })) as typeof fetch;
    const budget = context();
    const out = await resolveV2Reference("Reference", movie, budget);
    assert.equal(out.state, "request_failed");
    assert.match(out.error ?? "", /timed out after 5ms/);
    assert.equal(budget.used, 1);
    assert.equal(budget.calls?.[0].attempts, 1);
  });

  it("charges rejected network attempts as well as HTTP responses", async () => {
    let fetches = 0;
    globalThis.fetch = (async () => {
      fetches += 1;
      if (fetches === 1) throw new TypeError("synthetic network failure");
      return json(search());
    }) as typeof fetch;
    const budget = context(2);
    const out = await resolveV2Reference("Reference", movie, budget);
    assert.equal(out.state, "resolved");
    assert.equal(fetches, 2);
    assert.equal(budget.used, 2);
    assert.equal(budget.calls?.[0].attempts, 2);
  });

  it("cancels retry backoff promptly without another HTTP attempt", async () => {
    const controller = new AbortController();
    const budget = context(40, controller.signal);
    let fetches = 0;
    globalThis.fetch = (async () => {
      fetches += 1;
      return json({ error: "busy" }, 503);
    }) as typeof fetch;
    const started = Date.now();
    const timer = setTimeout(() => controller.abort(), 20);
    try {
      const out = await resolveV2Reference("Reference", movie, budget);
      assert.equal(out.state, "request_failed");
      assert.equal(fetches, 1);
      assert.equal(budget.used, 1);
      assert.match(out.provenance, /cancelled/);
      assert.ok(Date.now() - started < 250, "abort must not wait out backoff");
    } finally {
      clearTimeout(timer);
    }
  });

  it("does not spend or serve cached data after pre-cancellation", async () => {
    let fetches = 0;
    globalThis.fetch = (async () => {
      fetches += 1;
      return json(search());
    }) as typeof fetch;
    const controller = new AbortController();
    const budget = context(2, controller.signal);
    await resolveV2Reference("Reference", movie, budget);
    controller.abort();
    const out = await resolveV2Reference("Reference", movie, budget);
    assert.equal(out.state, "request_failed");
    assert.equal(fetches, 1);
    assert.equal(budget.used, 1);
    assert.equal(budget.calls?.[1].attempts, 0);
    assert.match(budget.calls?.[1].error ?? "", /cancelled/);
  });

  it("keeps absent configuration unavailable, while preserving v1 mock mode", async () => {
    delete process.env.QLOO_API_KEY;
    let fetches = 0;
    globalThis.fetch = (async () => {
      fetches += 1;
      return json(search());
    }) as typeof fetch;
    const budget = context();
    const identity = await resolveV2Reference("Reference", movie, budget);
    const discovery = await fetchV2DiscoveryCategory(
      "R1",
      "a1",
      artist,
      [],
      budget,
    );
    const reach = await fetchV2ReachCategory("n1", ["C1"], podcast, budget);
    assert.equal(identity.state, "request_failed");
    assert.equal(discovery.status, "failed");
    assert.equal(reach.status, "failed");
    assert.equal(fetches, 0);
    assert.equal(budget.used, 0);
    assert.equal(budget.calls?.length, 3);
    for (const call of budget.calls ?? []) {
      assert.equal(call.attempts, 0);
      assert.equal(call.fromCache, false);
      assert.equal(call.response, null);
      assert.match(call.error ?? "", /not configured/);
    }
    assert.match(identity.provenance, /not configured/);
    assert.match(discovery.queryProvenance, /not configured/);
    assert.match(reach.queryProvenance, /not configured/);
    const legacy = await qlooFetch("/search", { query: "Reference" });
    assert.deepEqual(legacy.data, { success: true, mock: true, results: [] });
    assert.equal(legacy.trace.fromCache, true);
  });

  it("distinguishes completed empty retrieval from malformed provider responses", async () => {
    const budget = context();
    globalThis.fetch = (async () =>
      json({ results: { entities: [] } })) as typeof fetch;
    const empty = await fetchV2DiscoveryCategory(
      "R1",
      "a1",
      artist,
      [],
      budget,
    );
    assert.equal(empty.status, "empty");
    assert.equal(empty.callId, budget.calls?.[0].id);
    globalThis.fetch = (async () =>
      json({ results: { entities: "wrong" } })) as typeof fetch;
    const malformed = await fetchV2DiscoveryCategory(
      "R2",
      "a2",
      artist,
      [],
      budget,
    );
    assert.equal(malformed.status, "failed");
    assert.match(malformed.queryProvenance, /malformed/);
    assert.equal(malformed.callId, budget.calls?.[1].id);
    assert.deepEqual(budget.calls?.[1].response, {
      results: { entities: "wrong" },
    });
    assert.match(budget.calls?.[1].error ?? "", /malformed/);
    globalThis.fetch = (async () =>
      new Response("not JSON", { status: 200 })) as typeof fetch;
    const invalidJson = await resolveV2Reference("Invalid", movie, budget);
    assert.equal(invalidJson.state, "request_failed");
    assert.match(invalidJson.provenance, /JSON/);
    assert.equal(budget.calls?.[2].response, "not JSON");
    globalThis.fetch = (async () =>
      json({ success: false, results: [] })) as typeof fetch;
    const rejected = await fetchV2ReachCategory("n1", ["C1"], podcast, budget);
    assert.equal(rejected.status, "failed");
    assert.match(rejected.queryProvenance, /provider/);
    assert.equal(budget.used, 4);
  });

  it("does not cache malformed identity envelopes as completed negative lookups", async () => {
    let fetches = 0;
    globalThis.fetch = (async () => {
      fetches += 1;
      return fetches === 1 ? json({ results: {} }) : json({ results: [] });
    }) as typeof fetch;
    const budget = context();
    const malformed = await resolveV2Reference("Missing", movie, budget);
    const completed = await resolveV2Reference("Missing", movie, budget);
    assert.equal(malformed.state, "request_failed");
    assert.match(malformed.error ?? "", /malformed/);
    assert.equal(completed.state, "not_found");
    assert.equal(fetches, 2);
    assert.equal(budget.used, 2);
    assert.notEqual(malformed.callId, completed.callId);
    assert.equal(budget.calls?.[1].error, undefined);
  });

  it("preserves server-side and local seed exclusions with traceable evidence", async () => {
    globalThis.fetch = (async (url) => {
      assert.equal(
        new URL(String(url)).searchParams.get("filter.exclude.entities"),
        "R1,R2",
      );
      return json({
        results: [
          { entity_id: "R1", name: "Excluded Seed" },
          { entity_id: "C1", name: "Connected Work", tags: ["t1"] },
        ],
      });
    }) as typeof fetch;
    const budget = context();
    const out = await fetchV2DiscoveryCategory(
      "R1",
      "a1",
      artist,
      ["R1", "R2"],
      budget,
    );
    assert.equal(out.status, "ok");
    assert.deepEqual(
      out.entities.map((entity) => entity.id),
      ["C1"],
    );
    assert.deepEqual(out.entities[0].tags, ["t1"]);
    assert.equal(out.callId, budget.calls?.[0].id);
    assert.equal(budget.calls?.[0].params["filter.exclude.entities"], "R1,R2");
  });

  it("records usable key-free structured traces, response data and call citations", async () => {
    const payload = {
      ...insights(),
      api_key: "test-key",
      nested: { authorization: "Bearer test-key", echo: "test-key" },
    };
    globalThis.fetch = (async () => json(payload)) as typeof fetch;
    const budget = context();
    const out = await fetchV2DiscoveryCategory(
      "R1",
      "a1",
      artist,
      ["R1"],
      budget,
    );
    assert.equal(out.status, "ok");
    const call = budget.calls?.[0];
    assert.ok(call);
    assert.equal(out.callId, call.id);
    assert.equal(call.endpoint, "/v2/insights");
    assert.equal(call.method, "GET");
    assert.equal(call.attempts, 1);
    assert.equal(call.status, 200);
    assert.deepEqual(call.params, {
      "signal.interests.entities": "R1",
      "filter.type": artist,
      take: "20",
      "filter.exclude.entities": "R1",
    });
    assert.equal(typeof call.at, "string");
    assert.equal(typeof call.durationMs, "number");
    assert.doesNotMatch(JSON.stringify(call), /test-key|Bearer test-key/);
    assert.deepEqual(
      (call.response as typeof payload).results,
      payload.results,
    );

    const direct = context();
    globalThis.fetch = (async () =>
      json({ ...search(), api_key: "test-key" })) as typeof fetch;
    const result = await qlooFetch(
      "/search",
      { query: "Reference", api_key: "test-key" },
      direct,
    );
    assert.doesNotMatch(JSON.stringify(result.trace), /test-key/);
    assert.doesNotMatch(JSON.stringify(direct.calls), /test-key/);
  });

  it("bounds captured responses and explicitly discloses truncation", async () => {
    globalThis.fetch = (async () =>
      json({ ...search(), padding: "x".repeat(100_000) })) as typeof fetch;
    const budget = context();
    const out = await resolveV2Reference("Reference", movie, budget);
    assert.equal(out.state, "resolved");
    assert.equal(budget.calls?.[0].responseTruncated, true);
    assert.ok(JSON.stringify(budget.calls?.[0].response).length < 70_000);
  });

  it("exposes a trace on transport quota failures without charging an HTTP attempt", async () => {
    const budget = context(0);
    await assert.rejects(
      qlooFetch("/search", { query: "Reference" }, budget),
      (err) => {
        assert.ok(err instanceof QlooQuotaError);
        assert.ok(!(err instanceof QlooError));
        assert.equal(err.usage.calls, 0);
        assert.equal(budget.calls?.[0].id, err.trace.id);
        return true;
      },
    );
    assert.equal(budget.used, 0);
    assert.equal(budget.calls?.[0].attempts, 0);
  });
});
