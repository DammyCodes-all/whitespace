import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { parseV2Result } from "../../components/v2-replay.ts";
import type { V2Result } from "../pipeline/v2/types.ts";
import {
  clearLatestV2Id,
  latestV2Id,
  loadV2Result,
  saveV2Result,
} from "./v2-store.ts";

/** All entities, payloads, and links in these tests are synthetic. */
function result(): V2Result {
  const entity = {
    id: "core-1",
    name: "Synthetic core",
    type: "urn:entity:movie",
    position: 1,
    tags: ["synthetic:quiet"],
  };
  return {
    runId: "synthetic-replay",
    reportState: "hypotheses",
    dataState: "complete",
    input: {
      pitchText: "A quiet film.",
      workType: "film",
      comparisons: ["Synthetic comparison"],
      contrasts: ["Synthetic contrast"],
    },
    brief: {
      interpretation: "A quiet film.",
      aspects: [
        {
          id: "a-1",
          facet: "tone",
          excerpt: "quiet",
          interpretation: "Quiet tone",
        },
      ],
      constraints: [],
      contrasts: [],
      unrepresentable: [],
    },
    lenses: [
      {
        aspectId: "a-1",
        candidates: [
          {
            name: "Synthetic reference",
            entityType: "urn:entity:movie",
            analogy: "Quiet tone",
          },
        ],
        selectedName: "Synthetic reference",
        entityId: "reference-1",
        entityName: "Synthetic reference",
        entityType: "urn:entity:movie",
        identity: "resolved",
        bridge: "llm-provisional",
        analogy: "Quiet tone",
        role: "discovery",
        callId: "lookup-1",
      },
    ],
    manifest: {
      runId: "synthetic-replay",
      pipelineVersion: "v2-lean.6",
      policyVersion: "v2-policy.3",
      frozenSeedIds: ["reference-1"],
      discoveryLensIds: ["a-1"],
      supportingLensIds: [],
      targetCategories: ["urn:entity:movie"],
      retrievalTake: 20,
      attemptCeiling: 40,
      knownFamilyLinks: [],
    },
    neighborhoods: [
      {
        id: "n-1",
        coreMemberIds: ["core-1"],
        members: [entity],
        sharedDescriptor: "synthetic:quiet",
        coherent: true,
        coverage: 2,
        corroboration: 1,
        pitchSupported: true,
        supportingEvidence: [],
        evidenceIds: ["query-1"],
      },
    ],
    candidateHypotheses: [],
    explorations: [
      {
        aspectId: "a-1",
        referenceName: "Synthetic reference",
        bridge: "llm-provisional",
        entities: [entity],
        queryProvenance: ["synthetic query"],
        suggestedAction: "Investigate",
        evidenceIds: ["query-1"],
      },
    ],
    limitations: ["Synthetic fixture only"],
    leads: [
      {
        id: "lead-1",
        name: "Synthetic podcast",
        type: "urn:entity:podcast",
        neighborhoodId: "n-1",
        seedIds: ["core-1"],
        category: "urn:entity:podcast",
        link: "https://example.com/synthetic",
        investigationAction: "Investigate",
        queryProvenance: "synthetic lead query",
        callId: "query-1",
      },
    ],
    explanations: [
      {
        neighborhoodId: "n-1",
        name: "Quiet references",
        whyInvestigate: "Investigate",
        source: "deterministic",
      },
    ],
    comparisons: [
      {
        query: "Synthetic comparison",
        entityId: "comparison-1",
        entityName: "Synthetic comparison",
        identity: "resolved",
        category: "urn:entity:movie",
        entities: [entity],
        queryProvenance: ["synthetic comparison query"],
        evidenceIds: ["query-1"],
      },
    ],
    calls: [
      {
        id: "query-1",
        endpoint: "/v2/insights",
        method: "GET",
        params: { "filter.type": "urn:entity:movie" },
        status: 200,
        durationMs: 10,
        at: "2026-10-10T00:00:00Z",
        fromCache: false,
        response: { results: [entity] },
        attempts: 1,
      },
    ],
    retrievals: [
      {
        aspectId: "a-1",
        category: "urn:entity:movie",
        status: "ok",
        entities: [entity],
        queryProvenance: "synthetic query",
        callId: "query-1",
      },
    ],
    usage: { httpAttempts: 1, ceiling: 40, llmCalls: 1, latencyMs: 100 },
  };
}

class BrowserStorage implements Storage {
  data = new Map<string, string>();
  failWrite: string | null = null;
  get length() {
    return this.data.size;
  }
  clear() {
    this.data.clear();
  }
  key(index: number) {
    return [...this.data.keys()][index] ?? null;
  }
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
  setItem(key: string, value: string) {
    if (this.failWrite === key || this.failWrite === "all")
      throw new Error("Synthetic quota failure");
    this.data.set(key, value);
  }
}

const PREFIX = "whitespace:v2:";
let store: BrowserStorage;
let originalWindow: PropertyDescriptor | undefined;
beforeEach(() => {
  originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  store = new BrowserStorage();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { localStorage: store },
  });
});
afterEach(() => {
  if (originalWindow)
    Object.defineProperty(globalThis, "window", originalWindow);
  else Reflect.deleteProperty(globalThis, "window");
});

function seed(value: unknown, id = "synthetic-replay") {
  store.setItem(`${PREFIX}${id}`, JSON.stringify(value));
  store.setItem(`${PREFIX}latest`, id);
}

describe("v2 browser replay", () => {
  it("round-trips nested evidence and full creator context", () => {
    const saved = result();
    assert.equal(saveV2Result(saved), true);
    assert.deepEqual(loadV2Result(saved.runId as string), saved);
    assert.equal(latestV2Id(), saved.runId);
  });

  for (const reportState of [
    "needs-clarification",
    "unsupported",
    "unable-to-assess",
    "exploration-only",
    "no-supported-hypothesis",
    "hypotheses",
  ] as const) {
    it(`persists ${reportState} without a manifest`, () => {
      const saved = { ...result(), manifest: null, brief: null, reportState };
      assert.equal(saveV2Result(saved), true);
      assert.deepEqual(loadV2Result(saved.runId as string), saved);
    });
  }

  it("requires an independent run ID for new outputs", () => {
    const saved = result();
    delete saved.runId;
    assert.equal(saveV2Result(saved), false);
    assert.equal(latestV2Id(), null);
  });

  it("keeps well-formed v2-lean.1–5 artifacts readable by manifest ID", () => {
    for (let version = 1; version <= 5; version++) {
      const raw = JSON.parse(JSON.stringify(result()));
      delete raw.runId;
      delete raw.calls;
      delete raw.retrievals;
      raw.manifest.pipelineVersion = `v2-lean.${version}`;
      raw.manifest.policyVersion = "v2-policy.2";
      raw.input.confirmedAnalogies = ["a-1"];
      if (version < 2) delete raw.neighborhoods[0].supportingEvidence;
      if (version < 3) delete raw.leads;
      if (version < 4) delete raw.explanations;
      if (version < 5) {
        delete raw.comparisons;
        delete raw.usage.latencyMs;
      }
      seed(raw);
      const restored = loadV2Result("synthetic-replay");
      assert.notEqual(restored, null);
      assert.deepEqual(restored?.input.confirmedAnalogies, []);
      assert.equal(restored?.calls, undefined);
      assert.deepEqual(restored?.input.comparisons, ["Synthetic comparison"]);
    }
  });

  it("never falls back to an unrelated latest save for a requested run", () => {
    seed(result());
    assert.equal(loadV2Result("missing-run"), null);
    assert.equal(latestV2Id(), "synthetic-replay");
  });

  it("quarantines a mismatched ID and its latest pointer", () => {
    seed(result(), "wrong-id");
    assert.equal(loadV2Result("wrong-id"), null);
    assert.equal(store.getItem(`${PREFIX}wrong-id`), null);
    assert.equal(latestV2Id(), null);
  });

  it("quarantines malformed JSON and dangling latest pointers", () => {
    store.setItem(`${PREFIX}synthetic-replay`, "{broken");
    store.setItem(`${PREFIX}latest`, "synthetic-replay");
    assert.equal(latestV2Id(), null);
    assert.equal(store.getItem(`${PREFIX}synthetic-replay`), null);
    store.setItem(`${PREFIX}latest`, "missing-run");
    assert.equal(latestV2Id(), null);
    assert.equal(store.getItem(`${PREFIX}latest`), null);
  });

  it("invalidates latest before a request or failed response", () => {
    seed(result());
    assert.equal(clearLatestV2Id(), true);
    assert.equal(latestV2Id(), null);
    assert.notEqual(loadV2Result("synthetic-replay"), null);
  });

  for (const failedKey of [`${PREFIX}next-run`, `${PREFIX}latest`, "all"]) {
    it(`reports write failure at ${failedKey} without a stale latest`, () => {
      seed(result());
      store.failWrite = failedKey;
      const next = { ...result(), runId: "next-run", manifest: null };
      assert.equal(saveV2Result(next), false);
      assert.equal(store.getItem(`${PREFIX}latest`), null);
      assert.equal(latestV2Id(), null);
    });
  }

  it("reports blocked storage/SSR honestly with no memory replay", () => {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        get localStorage() {
          throw new Error("Synthetic blocked storage");
        },
      },
    });
    assert.equal(saveV2Result(result()), false);
    assert.equal(loadV2Result("synthetic-replay"), null);
    assert.equal(latestV2Id(), null);
    Reflect.deleteProperty(globalThis, "window");
    assert.equal(saveV2Result(result()), false);
    assert.equal(loadV2Result("synthetic-replay"), null);
  });
});

describe("HTTP and storage share full nested validation", () => {
  const corruptions: [string, string[], unknown][] = [
    ["missing brief", ["brief"], undefined],
    ["unknown report state", ["reportState"], "Strong"],
    ["unknown data state", ["dataState"], "cached"],
    ["unknown version", ["manifest", "pipelineVersion"], "v2-lean.99"],
    ["unknown policy", ["manifest", "policyVersion"], "v2-policy.99"],
    ["unknown work type", ["input", "workType"], "app"],
    ["invalid comparisons", ["input", "comparisons"], [null]],
    ["unsafe positional approvals", ["input", "confirmedAnalogies"], ["a-1"]],
    [
      "partial confirmed object",
      ["input", "confirmedAnalogies"],
      [{ aspectId: "a-1" }],
    ],
    ["partial prepared brief", ["input", "preparedBrief"], { brief: null }],
    ["unknown facet", ["brief", "aspects", "0", "facet"], "audience"],
    ["bad constraints", ["brief", "constraints"], [false]],
    ["unknown identity", ["lenses", "0", "identity"], "found"],
    ["unknown bridge", ["lenses", "0", "bridge"], "verified"],
    ["unknown role", ["lenses", "0", "role"], "overlay"],
    ["bad candidate", ["lenses", "0", "candidates"], [null]],
    ["bad member", ["neighborhoods", "0", "members"], [null]],
    ["bad member tags", ["neighborhoods", "0", "members", "0", "tags"], [8]],
    ["bad count", ["neighborhoods", "0", "coverage"], "2"],
    ["bad support", ["neighborhoods", "0", "supportingEvidence"], {}],
    [
      "bad exploration entity",
      ["explorations", "0", "entities", "0", "name"],
      {},
    ],
    ["bad comparison", ["comparisons", "0", "queryProvenance"], null],
    ["unknown explanation source", ["explanations", "0", "source"], "invented"],
    ["script link", ["leads", "0", "link"], "javascript:alert(1)"],
    ["relative link", ["leads", "0", "link"], "//example.com"],
    ["credentialed link", ["leads", "0", "link"], "https://secret@example.com"],
    ["bad lead seed", ["leads", "0", "seedIds"], [null]],
    ["bad trace params", ["calls", "0", "params"], { query: {} }],
    ["auth-bearing endpoint", ["calls", "0", "endpoint"], "/search?key=secret"],
    ["invalid attempts", ["calls", "0", "attempts"], -1],
    ["unknown retrieval status", ["retrievals", "0", "status"], "timeout"],
    ["bad evidence ID", ["neighborhoods", "0", "evidenceIds"], [false]],
    ["invalid usage", ["usage", "httpAttempts"], null],
    ["missing introduced field", ["leads"], undefined],
    ["missing latency", ["usage", "latencyMs"], undefined],
  ];
  for (const [name, path, value] of corruptions) {
    it(`rejects and quarantines ${name}`, () => {
      const raw: Record<string, unknown> = JSON.parse(JSON.stringify(result()));
      let parent = raw;
      for (const key of path.slice(0, -1))
        parent = parent[key] as Record<string, unknown>;
      parent[path[path.length - 1]] = value;
      assert.equal(parseV2Result(raw), null, "HTTP boundary rejects it");
      seed(raw);
      assert.equal(loadV2Result("synthetic-replay"), null);
      assert.equal(latestV2Id(), null);
      assert.equal(store.getItem(`${PREFIX}synthetic-replay`), null);
    });
  }

  it("rejects duplicate call IDs", () => {
    const raw = result();
    raw.calls?.push(raw.calls[0]);
    assert.equal(parseV2Result(raw), null);
  });

  it("rejects non-JSON responses and non-finite counters", () => {
    const raw = result();
    if (raw.calls) raw.calls[0].response = { invalid: undefined };
    assert.equal(parseV2Result(raw), null);
    assert.equal(
      parseV2Result({
        ...result(),
        usage: { ...result().usage, latencyMs: NaN },
      }),
      null,
    );
  });
});
