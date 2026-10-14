import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MIN_MATCHED_TAGS } from "../config.ts";
import { clearControlCache } from "../qloo/control-cache.ts";
import { CONTROL_SEEDS } from "../qloo/control-seeds.ts";
import { runFlowPitch } from "./run-flow.ts";

// No key in this env: the mock path. Taste fetches fail, so the run is
// honestly Inconclusive — the flow's gates still run first.
delete process.env.QLOO_API_KEY;

const tags = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    label: `word${i}`,
    qlooId: `urn:tag:w${i}`,
    status: "matched" as const,
  }));

describe("runFlowPitch", () => {
  const pitch = "A quiet science-fiction film about a lonely worker.";
  const base = {
    pitchText: pitch,
    workType: "film" as const,
    nothingLike: [],
    similarTitles: ["Moon", "Arrival", "Dune"],
  };

  it("stops as Inconclusive below the matched-tag gate, with no scoring steps", async () => {
    const out = await runFlowPitch({
      ...base,
      tags: [
        ...tags(MIN_MATCHED_TAGS - 1),
        { label: "cozy", status: "not_found" },
      ],
    });
    assert.equal(out.stopped, true);
    assert.equal(out.result.verdict, "inconclusive");
    assert.deepEqual(
      out.steps.map((s) => s.id),
      ["tags", "verdict"],
    );
  });

  it("runs the scored path and reports matched tags plus not-found words", async () => {
    const out = await runFlowPitch({
      ...base,
      tags: [...tags(MIN_MATCHED_TAGS), { label: "cozy", status: "not_found" }],
    });
    assert.equal(out.stopped, false);
    const tagChips = out.result.tags;
    assert.equal(tagChips.length, MIN_MATCHED_TAGS + 1);
    assert.equal(
      tagChips.filter((t) => t.status === "matched").length,
      MIN_MATCHED_TAGS,
    );
    // Mock path: every audience is unjudgeable, so nothing is a number
    // and the ceiling is null rather than 0.
    assert.ok(out.result.audiences.every((a) => a.score === null));
    assert.equal(out.result.ceiling, null);
    assert.equal(out.result.reach, null);
  });

  it("reports Qloo call usage from the run", async () => {
    const out = await runFlowPitch({
      ...base,
      tags: tags(MIN_MATCHED_TAGS),
    });
    assert.equal(typeof out.result.qlooCalls.total, "number");
    assert.ok(out.result.qlooCalls.total >= 0);
  });

  it("scope gate refuses a tool pitch with no Qloo calls", async () => {
    const out = await runFlowPitch({
      pitchText:
        "I want to build a telegram bot that tracks workouts and sends reminders.",
      workType: "film",
      nothingLike: [],
      similarTitles: [],
      tags: tags(MIN_MATCHED_TAGS),
    });
    assert.equal(out.stopped, true);
    assert.equal(out.result.verdict, "inconclusive");
    assert.equal(out.steps[0]?.id, "scope");
    assert.equal(out.result.qlooCalls.total, 0);
  });

  it("stops before controls when there is nothing to judge", async () => {
    // No similar titles plus mock-path discovery (results: []) means no
    // contenders: the run must stop before the control load, naming the
    // cause instead of burning ~90 calls on an empty verdict.
    const out = await runFlowPitch({
      ...base,
      similarTitles: [],
      tags: tags(MIN_MATCHED_TAGS),
    });
    assert.equal(out.stopped, true);
    assert.equal(out.result.verdict, "inconclusive");
    assert.deepEqual(
      out.steps.map((s) => s.id),
      ["rivals", "verdict"],
    );
    assert.match(out.steps[1]?.detail ?? "", /nothing to judge/);
  });

  it("names a failed bridge attempt and scores exact matches only", async (t) => {
    // Synthetic keys only; the stubbed transport throws so no request
    // ever leaves the process and the bridge path yields nothing.
    const savedGroq = process.env.GROQ_API_KEY;
    const savedRouter = process.env.OPENROUTER_API_KEY;
    process.env.GROQ_API_KEY = "synthetic-test-key";
    delete process.env.OPENROUTER_API_KEY;
    try {
      t.mock.method(globalThis, "fetch", async () => {
        throw new Error("Synthetic LLM failure.");
      });
      const out = await runFlowPitch({
        ...base,
        tags: tags(MIN_MATCHED_TAGS),
      });
      assert.equal(out.stopped, false);
      const score = out.steps.find((s) => s.id === "score");
      assert.match(
        score?.detail ?? "",
        /bridges unavailable, exact matches scored/,
      );
      assert.doesNotMatch(
        score?.detail ?? "",
        /groq|openrouter|\b4\d\d\b|\b5\d\d\b/i,
      );
      assert.ok(!(score?.detail ?? "").includes("+"));
      // Exact-only: the mock path leaves every audience unjudgeable.
      assert.ok(out.result.audiences.every((a) => a.score === null));
    } finally {
      if (savedGroq === undefined) delete process.env.GROQ_API_KEY;
      else process.env.GROQ_API_KEY = savedGroq;
      if (savedRouter === undefined) delete process.env.OPENROUTER_API_KEY;
      else process.env.OPENROUTER_API_KEY = savedRouter;
    }
  });

  it("strangers set the line even when a control scores higher", async (t) => {
    // Synthetic keys only; the stubbed transport answers every Qloo
    // call in-process, and LLM keys are cleared so no model call can
    // fire. Far tastes score 0.40 while one control scores ~0.59: the
    // verdict must follow the strangers line (Mixed on the close
    // second), never the higher control (which would read Weak).
    const savedKey = process.env.QLOO_API_KEY;
    const savedGroq = process.env.GROQ_API_KEY;
    const savedRouter = process.env.OPENROUTER_API_KEY;
    process.env.QLOO_API_KEY = "synthetic-test-key";
    delete process.env.GROQ_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    clearControlCache();
    try {
      const ids = (names: string[]) =>
        names.map((id) => ({ tag_id: id, name: id }));
      // alpha@1 + beta@11 + gamma absent = (1 + 0.8 + 0) / 3 = 0.6.
      const hypTags = [
        "urn:tag:alpha",
        ...Array.from({ length: 9 }, (_, i) => `urn:tag:h${i}`),
        "urn:tag:beta",
        ...Array.from({ length: 39 }, (_, i) => `urn:tag:hx${i}`),
      ];
      // alpha@1 + beta@41 + gamma absent = (1 + 0.2 + 0) / 3 = 0.4.
      const farTags = [
        "urn:tag:alpha",
        ...Array.from({ length: 39 }, (_, i) => `urn:tag:f${i}`),
        "urn:tag:beta",
        ...Array.from({ length: 9 }, (_, i) => `urn:tag:fx${i}`),
      ];
      // alpha@1 + beta@14 + gamma absent = (1 + 0.74 + 0) / 3 = 0.58.
      const secondTags = [
        "urn:tag:alpha",
        ...Array.from({ length: 12 }, (_, i) => `urn:tag:s${i}`),
        "urn:tag:beta",
        ...Array.from({ length: 36 }, (_, i) => `urn:tag:sx${i}`),
      ];
      // alpha@1 + beta@13 + gamma absent = (1 + 0.76 + 0) / 3 = 0.5867.
      const highTags = [
        "urn:tag:alpha",
        ...Array.from({ length: 11 }, (_, i) => `urn:tag:c${i}`),
        "urn:tag:beta",
        ...Array.from({ length: 37 }, (_, i) => `urn:tag:cx${i}`),
      ];
      // gamma@25 only = 0.52 / 3.
      const lowTags = [
        ...Array.from({ length: 24 }, (_, i) => `urn:tag:low${i}`),
        "urn:tag:gamma",
        ...Array.from({ length: 25 }, (_, i) => `urn:tag:lowx${i}`),
      ];
      const nearId = `id:${CONTROL_SEEDS.film[0]?.titles[0] ?? ""}`;
      const farIds = new Set<string>();
      t.mock.method(globalThis, "fetch", (async (input: unknown) => {
        const url = new URL(String(input));
        if (url.pathname === "/search") {
          const query = url.searchParams.get("query") ?? "";
          return new Response(
            JSON.stringify({
              success: true,
              results: [
                {
                  entity_id: `id:${query}`,
                  name: query,
                  type: "urn:entity:movie",
                },
              ],
            }),
            { status: 200 },
          );
        }
        const filterType = url.searchParams.get("filter.type") ?? "";
        if (filterType === "urn:tag") {
          const entities = (
            url.searchParams.get("signal.interests.entities") ?? ""
          ).split(",");
          let tags = lowTags;
          if (entities.includes("id:Moon")) tags = hypTags;
          else if (entities.some((e) => farIds.has(e))) tags = farTags;
          else if (entities.includes(nearId)) tags = highTags;
          else if (entities.some((e) => e.startsWith("id:mov-"))) {
            // Rival-1 (own domain): the close second.
            tags = secondTags;
          }
          return new Response(
            JSON.stringify({ success: true, results: { tags: ids(tags) } }),
            { status: 200 },
          );
        }
        if (
          filterType === "urn:entity:podcast" ||
          filterType === "urn:entity:person" ||
          filterType === "urn:entity:brand" ||
          filterType === "urn:entity:place"
        ) {
          return new Response(JSON.stringify({ success: true, results: [] }), {
            status: 200,
          });
        }
        // Discovery: own domain carries a long tail so the far
        // candidate sits at the bottom, unused by any rival.
        const isOwn = filterType === "urn:entity:movie";
        const count = isOwn ? 6 : 2;
        const tag = isOwn ? "mov" : filterType;
        const entities = Array.from({ length: count }, (_, i) => ({
          entity_id: `id:${tag}-e${i + 1}`,
          name: `Rival ${tag} ${i + 1}`,
        }));
        return new Response(
          JSON.stringify({ success: true, results: entities }),
          { status: 200 },
        );
      }) as typeof fetch);
      // The own-domain tail stays unused: with 3 rivals only e1+e2
      // feed rival-1, so e6 (lead) and e5 (member) become strangers.
      for (const e of ["id:mov-e6", "id:mov-e5"]) {
        farIds.add(e);
      }
      const out = await runFlowPitch({
        pitchText: pitch,
        workType: "film",
        nothingLike: [],
        similarTitles: ["Moon"],
        tags: [
          { label: "alpha", qlooId: "urn:tag:alpha", status: "matched" },
          { label: "beta", qlooId: "urn:tag:beta", status: "matched" },
          { label: "gamma", qlooId: "urn:tag:gamma", status: "matched" },
        ],
      });
      assert.equal(out.stopped, false);
      // Top 0.6 clears strangers 0.4; the 0.58 second also clears and
      // sits close, so the existing split branch reads Mixed. A
      // control-set line at 0.5867 would have read Weak.
      assert.equal(out.result.verdict, "mixed");
      const controlsStep = out.steps.find((s) => s.id === "controls");
      assert.match(controlsStep?.detail ?? "", /line from strangers baseline/);
      assert.ok(
        out.result.ceiling !== null &&
          Math.abs(out.result.ceiling - 0.4) < 1e-9,
      );
      // The higher control is still measured honestly — just not the line.
      const high = out.result.audiences.find(
        (a) => a.name === "Blockbuster action",
      );
      assert.ok(
        high !== undefined &&
          high.score !== null &&
          high.score > (out.result.ceiling ?? 0),
      );
    } finally {
      if (savedKey === undefined) delete process.env.QLOO_API_KEY;
      else process.env.QLOO_API_KEY = savedKey;
      if (savedGroq === undefined) delete process.env.GROQ_API_KEY;
      else process.env.GROQ_API_KEY = savedGroq;
      if (savedRouter === undefined) delete process.env.OPENROUTER_API_KEY;
      else process.env.OPENROUTER_API_KEY = savedRouter;
      clearControlCache();
    }
  });

  it("unmeasured strangers fall back to the other-genre ceiling", async (t) => {
    // Same hermetic setup, but the strangers' tastes come back empty
    // (unjudgeable) and the first control resolves onto the named
    // title (excluded by the untouched title rule). The line must be
    // the best title-eligible control, named as the fallback.
    const savedKey = process.env.QLOO_API_KEY;
    const savedGroq = process.env.GROQ_API_KEY;
    const savedRouter = process.env.OPENROUTER_API_KEY;
    process.env.QLOO_API_KEY = "synthetic-test-key";
    delete process.env.GROQ_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    clearControlCache();
    try {
      const ids = (names: string[]) =>
        names.map((id) => ({ tag_id: id, name: id }));
      const hypTags = [
        "urn:tag:alpha",
        "urn:tag:beta",
        "urn:tag:gamma",
        ...Array.from({ length: 47 }, (_, i) => `urn:tag:h${i}`),
      ];
      const lowTags = [
        ...Array.from({ length: 24 }, (_, i) => `urn:tag:low${i}`),
        "urn:tag:gamma",
        ...Array.from({ length: 25 }, (_, i) => `urn:tag:lowx${i}`),
      ];
      // Own-domain tail (see the first test): e6 lead, e5 member.
      const strangerIds = new Set(["id:mov-e6", "id:mov-e5"]);
      t.mock.method(globalThis, "fetch", (async (input: unknown) => {
        const url = new URL(String(input));
        if (url.pathname === "/search") {
          const query = url.searchParams.get("query") ?? "";
          // The first control's lead title resolves onto the named
          // title: title overlap excludes it from the ceiling.
          const hit =
            query === "Die Hard"
              ? { entity_id: "id:Moon", name: "Moon" }
              : { entity_id: `id:${query}`, name: query };
          return new Response(
            JSON.stringify({
              success: true,
              results: [{ ...hit, type: "urn:entity:movie" }],
            }),
            { status: 200 },
          );
        }
        const filterType = url.searchParams.get("filter.type") ?? "";
        if (filterType === "urn:tag") {
          const entities = (
            url.searchParams.get("signal.interests.entities") ?? ""
          ).split(",");
          let tags = lowTags;
          if (entities.includes("id:Moon")) tags = hypTags;
          else if (entities.some((e) => strangerIds.has(e))) {
            // Strangers return nothing: unjudgeable, never the line.
            tags = [];
          }
          return new Response(
            JSON.stringify({ success: true, results: { tags: ids(tags) } }),
            { status: 200 },
          );
        }
        if (
          filterType === "urn:entity:podcast" ||
          filterType === "urn:entity:person" ||
          filterType === "urn:entity:brand" ||
          filterType === "urn:entity:place"
        ) {
          return new Response(JSON.stringify({ success: true, results: [] }), {
            status: 200,
          });
        }
        const isOwn = filterType === "urn:entity:movie";
        const count = isOwn ? 6 : 2;
        const tag = isOwn ? "mov" : filterType;
        const entities = Array.from({ length: count }, (_, i) => ({
          entity_id: `id:${tag}-e${i + 1}`,
          name: `Rival ${tag} ${i + 1}`,
        }));
        return new Response(
          JSON.stringify({ success: true, results: entities }),
          { status: 200 },
        );
      }) as typeof fetch);
      const out = await runFlowPitch({
        pitchText: pitch,
        workType: "film",
        nothingLike: [],
        similarTitles: ["Moon"],
        tags: [
          { label: "alpha", qlooId: "urn:tag:alpha", status: "matched" },
          { label: "beta", qlooId: "urn:tag:beta", status: "matched" },
          { label: "gamma", qlooId: "urn:tag:gamma", status: "matched" },
        ],
      });
      assert.equal(out.stopped, false);
      // Hypothesis 0.98 clears the eligible controls (0.1733); the
      // title-excluded control at 0.98 must not set the line.
      assert.equal(out.result.verdict, "strong");
      const controlsStep = out.steps.find((s) => s.id === "controls");
      assert.match(
        controlsStep?.detail ?? "",
        /strangers unmeasured, other-genre ceiling/,
      );
      assert.ok(
        out.result.ceiling !== null &&
          Math.abs(out.result.ceiling - 0.52 / 3) < 1e-9,
      );
    } finally {
      if (savedKey === undefined) delete process.env.QLOO_API_KEY;
      else process.env.QLOO_API_KEY = savedKey;
      if (savedGroq === undefined) delete process.env.GROQ_API_KEY;
      else process.env.GROQ_API_KEY = savedGroq;
      if (savedRouter === undefined) delete process.env.OPENROUTER_API_KEY;
      else process.env.OPENROUTER_API_KEY = savedRouter;
      clearControlCache();
    }
  });
});
