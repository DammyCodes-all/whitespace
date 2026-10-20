import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MIN_MATCHED_TAGS } from "../config.ts";
import { clearControlCache } from "../qloo/control-cache.ts";
import { CONTROL_SEEDS } from "../qloo/control-seeds.ts";
import { runFlowPitch } from "./run-flow.ts";

// No key in this env: the keyless path returns placeholder traces
// (`mock: true`, status 0). Taste fetches fail, so the run is honestly
// Inconclusive — the flow's gates still run first.
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
    similarTitles: ["Moon", "Arrival", "Dune"],
  };

  it("stops as Inconclusive on the cheap check with no titles and thin tags", async () => {
    const out = await runFlowPitch({
      ...base,
      similarTitles: [],
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
    assert.equal(out.result.qlooCalls.total, 0);
  });

  it("passes the cheap check with titles, then stops at the pool gate", async () => {
    // Titles exist so the run proceeds; the keyless path resolves nothing
    // and fetches no tastes, so the pool is just the MIN-1 pitch tags
    // and the real gate stops it after the fetches, naming the pool.
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
      ["hypothesis", "rivals", "tastes", "tags", "verdict"],
    );
    assert.match(
      out.steps.find((s) => s.id === "tags")?.detail ?? "",
      /below the \d+-tag gate/,
    );
    // The thin pool is still reported, with pitch provenance.
    assert.equal(
      out.result.tags.filter((t) => t.status === "matched").length,
      MIN_MATCHED_TAGS - 1,
    );
    assert.ok(
      out.result.tags.every(
        (t) => t.source === undefined || t.source === "pitch",
      ),
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
    // Keyless path: every audience is unjudgeable, so nothing is a number
    // and the ceiling is null rather than 0.
    assert.ok(out.result.audiences.every((a) => a.score === null));
    assert.equal(out.result.ceiling, null);
    assert.equal(out.result.reach, null);
    // §8: the real check ran and passed; the step names the counts.
    assert.equal(out.result.grounding?.ok, true);
    const groundingStep = out.steps.find((s) => s.id === "grounding");
    assert.ok(groundingStep !== undefined);
    assert.match(
      groundingStep.detail ?? "",
      /all from this run's Qloo results/,
    );
    // Title-grounded pool: the keyless path resolves nothing, so the pool
    // is the pitch tags only — all pitch-sourced, no hold-out rounds.
    const tagsStep = out.steps.find((s) => s.id === "tags");
    assert.match(tagsStep?.detail ?? "", /pooled/);
    assert.ok(!out.steps.some((s) => s.id.startsWith("holdout-")));
    assert.ok(out.result.tags.every((t) => t.source === "pitch"));
  });

  it("reports Qloo call usage from the run", async () => {
    const out = await runFlowPitch({
      ...base,
      tags: tags(MIN_MATCHED_TAGS),
    });
    assert.equal(typeof out.result.qlooCalls.total, "number");
    assert.ok(out.result.qlooCalls.total >= 0);
    // Keyless: every trace is a placeholder, so none counts as network.
    assert.equal(out.result.qlooCalls.network, 0);
    assert.equal(out.result.qlooCalls.mock, out.result.qlooCalls.total);
  });

  it("scope gate refuses a tool pitch with no Qloo calls", async () => {
    const out = await runFlowPitch({
      pitchText:
        "I want to build a telegram bot that tracks workouts and sends reminders.",
      workType: "film",
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

  it("scores exact matches when bridges explicitly off, no LLM call", async (t) => {
    // Synthetic keys only; the stubbed transport throws so any LLM
    // attempt would fail the run. Bridges stay off, so no request
    // ever leaves the process.
    const savedGroq = process.env.GROQ_API_KEY;
    const savedRouter = process.env.OPENROUTER_API_KEY;
    process.env.GROQ_API_KEY = "synthetic-test-key";
    delete process.env.OPENROUTER_API_KEY;
    try {
      t.mock.method(globalThis, "fetch", async () => {
        throw new Error("Synthetic LLM failure.");
      });
      const out = await runFlowPitch(
        {
          ...base,
          tags: tags(MIN_MATCHED_TAGS),
        },
        { bridgesEnabled: false },
      );
      assert.equal(out.stopped, false);
      const score = out.steps.find((s) => s.id === "score");
      assert.match(score?.detail ?? "", /bridges off, exact matches scored/);
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

  it("names a failed bridge attempt when bridges are enabled", async (t) => {
    // Same hermetic setup, bridges explicitly on: the stubbed
    // transport throws, so the bridge path yields nothing and the run
    // continues on exact matches.
    const savedGroq = process.env.GROQ_API_KEY;
    const savedRouter = process.env.OPENROUTER_API_KEY;
    process.env.GROQ_API_KEY = "synthetic-test-key";
    delete process.env.OPENROUTER_API_KEY;
    try {
      t.mock.method(globalThis, "fetch", async () => {
        throw new Error("Synthetic LLM failure.");
      });
      const out = await runFlowPitch(
        {
          ...base,
          tags: tags(MIN_MATCHED_TAGS),
        },
        { bridgesEnabled: true },
      );
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
    // fire. The pool is the top 12 of Moon's tastes (alpha, beta,
    // gamma, f1..f9 — each held by at most 1 of 20 controls, so the
    // generic cut keeps all 12). Scores on the 12-pool: hyp 0.89, a
    // close rival second at 0.89 (Mixed), far strangers at 0.1 (the
    // line), one control at ~0.21 (measured honestly, never the
    // line).
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
      // Moon's tastes: pool base is the top 12.
      const hypTags = [
        "urn:tag:alpha",
        "urn:tag:beta",
        "urn:tag:gamma",
        ...Array.from({ length: 9 }, (_, i) => `urn:tag:f${i + 1}`),
        ...Array.from({ length: 38 }, (_, i) => `urn:tag:g${i}`),
      ];
      // alpha@1 + beta@41 = (1 + 0.2) / 12 = 0.1.
      const farTags = [
        "urn:tag:alpha",
        ...Array.from({ length: 39 }, (_, i) => `urn:tag:ff${i}`),
        "urn:tag:beta",
        ...Array.from({ length: 9 }, (_, i) => `urn:tag:fx${i}`),
      ];
      // alpha@1 + beta@2 + f1..f9@3-11 + gamma@12 ties hyp at 0.89.
      const secondTags = [
        "urn:tag:alpha",
        "urn:tag:beta",
        ...Array.from({ length: 9 }, (_, i) => `urn:tag:f${i + 1}`),
        "urn:tag:gamma",
        ...Array.from({ length: 38 }, (_, i) => `urn:tag:sx${i}`),
      ];
      // alpha@1 + beta@13 + gamma@14 = (1 + 0.76 + 0.74) / 12.
      const highTags = [
        "urn:tag:alpha",
        ...Array.from({ length: 11 }, (_, i) => `urn:tag:c${i}`),
        "urn:tag:beta",
        "urn:tag:gamma",
        ...Array.from({ length: 36 }, (_, i) => `urn:tag:cx${i}`),
      ];
      // No pool tags: honest zeros, never the no-signal trip (the high
      // control above keeps the ceiling informative).
      const lowTags = Array.from({ length: 50 }, (_, i) => `urn:tag:low${i}`);
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
          return new Response(
            JSON.stringify({
              success: true,
              results: [
                {
                  entity_id: `id:reach-${filterType}`,
                  name: `Reach ${filterType}`,
                },
              ],
            }),
            { status: 200 },
          );
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
        similarTitles: ["Moon"],
        tags: [
          { label: "alpha", qlooId: "urn:tag:alpha", status: "matched" },
          { label: "beta", qlooId: "urn:tag:beta", status: "matched" },
          { label: "gamma", qlooId: "urn:tag:gamma", status: "matched" },
        ],
      });
      assert.equal(out.stopped, false);
      // Top 0.89 clears strangers 0.1; the 0.89 second also clears and
      // sits on top, so the existing split branch reads Mixed. A
      // control-set line at ~0.21 would have read Weak.
      assert.equal(out.result.verdict, "mixed");
      // §8/§10 #1: the check passed on the assembled output, and every
      // displayed id traces to a response this stub actually returned.
      assert.equal(out.result.grounding?.ok, true);
      assert.ok(out.steps.some((step) => step.id === "grounding"));
      for (const tag of out.result.tags) {
        assert.ok(
          tag.qlooId === undefined || hypTags.includes(tag.qlooId),
          `ungrounded tag ${tag.qlooId}`,
        );
      }
      for (const audience of out.result.audiences) {
        for (const title of audience.titles) {
          assert.match(title.qlooId, /^id:/);
        }
      }
      // §6.8/§8: the reach card is in the checked output too, not just
      // the chart rows. The stub returns one item per related category.
      assert.ok(out.result.reach !== null && out.result.reach.length > 0);
      const reachNames = out.result.reach.flatMap((group) => [
        ...group.people.map((item) => item.name),
        ...group.podcasts.map((item) => item.name),
        ...group.brands.map((item) => item.name),
        ...group.places.map((item) => item.name),
      ]);
      assert.ok(reachNames.length > 0);
      assert.ok(reachNames.every((name) => name.startsWith("Reach ")));
      const controlsStep = out.steps.find((s) => s.id === "controls");
      assert.match(controlsStep?.detail ?? "", /line from strangers baseline/);
      assert.ok(
        out.result.ceiling !== null &&
          Math.abs(out.result.ceiling - 0.1) < 1e-9,
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
      // Hold-out: the whole pool came from Moon, so one round drops
      // all 12 gifts and the named fit falls to zero — recorded as a
      // step, while the verdict above still uses the full set.
      const holdout = out.steps.find((s) => s.id === "holdout-1");
      assert.equal(holdout?.label, "Hold-out: Moon");
      assert.match(
        holdout?.detail ?? "",
        /without Moon's 12 tag\(s\): named 0\.89 → 0\.00 \(Δ -0\.89\)/,
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
    // title (excluded by the untouched title rule). The pool is the
    // top 12 of Moon's tastes; the 19 eligible controls each hold a
    // rotating pool tag at rank 25 (every pool tag stays under half
    // the lists, so the generic cut keeps all 12) and score a small
    // nonzero 0.52/12 — the line must be that eligible best, named as
    // the fallback, and never the excluded 0.89.
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
        ...Array.from({ length: 9 }, (_, i) => `urn:tag:f${i + 1}`),
        ...Array.from({ length: 38 }, (_, i) => `urn:tag:g${i}`),
      ];
      // Rivals hold no pool tags: honest zeros.
      const zeroTags = Array.from({ length: 50 }, (_, i) => `urn:tag:zz${i}`);
      const pool12 = [
        "urn:tag:alpha",
        "urn:tag:beta",
        "urn:tag:gamma",
        ...Array.from({ length: 9 }, (_, i) => `urn:tag:f${i + 1}`),
      ];
      let controlVariants = 0;
      const rotatingTags = (): string[] => {
        const held = pool12[controlVariants % pool12.length] as string;
        const v = controlVariants++;
        return [
          ...Array.from({ length: 24 }, (_, i) => `urn:tag:r${v}a${i}`),
          held,
          ...Array.from({ length: 25 }, (_, i) => `urn:tag:r${v}b${i}`),
        ];
      };
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
          let tags: string[];
          if (entities.includes("id:Moon")) tags = hypTags;
          else if (entities.some((e) => strangerIds.has(e))) {
            // Strangers return nothing: unjudgeable, never the line.
            tags = [];
          } else if (
            entities.some(
              (e) => e.startsWith("id:mov-") || e.includes("urn:entity"),
            )
          ) {
            // Rivals hold no pool tags.
            tags = zeroTags;
          } else {
            // Eligible controls: one rotating pool tag each.
            tags = rotatingTags();
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
          return new Response(
            JSON.stringify({
              success: true,
              results: [
                {
                  entity_id: `id:reach-${filterType}`,
                  name: `Reach ${filterType}`,
                },
              ],
            }),
            { status: 200 },
          );
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
        similarTitles: ["Moon"],
        tags: [
          { label: "alpha", qlooId: "urn:tag:alpha", status: "matched" },
          { label: "beta", qlooId: "urn:tag:beta", status: "matched" },
          { label: "gamma", qlooId: "urn:tag:gamma", status: "matched" },
        ],
      });
      assert.equal(out.stopped, false);
      // Hypothesis 0.89 clears the eligible controls (0.52/12 each);
      // the title-excluded control at 0.89 must not set the line.
      assert.equal(out.result.verdict, "strong");
      // Same gate on the fallback-ceiling path: the real check ran and
      // no displayed id came from outside this stub's Qloo responses.
      assert.equal(out.result.grounding?.ok, true);
      assert.ok(out.steps.some((step) => step.id === "grounding"));
      for (const tag of out.result.tags) {
        assert.ok(
          tag.qlooId === undefined || hypTags.includes(tag.qlooId),
          `ungrounded tag ${tag.qlooId}`,
        );
      }
      const controlsStep = out.steps.find((s) => s.id === "controls");
      assert.match(
        controlsStep?.detail ?? "",
        /strangers unmeasured, other-genre ceiling/,
      );
      assert.ok(
        out.result.ceiling !== null &&
          Math.abs(out.result.ceiling - 0.52 / 12) < 1e-9,
      );
      // Hold-out: one round for Moon's 12 gifts, verdict untouched.
      const holdout = out.steps.find((s) => s.id === "holdout-1");
      assert.equal(holdout?.label, "Hold-out: Moon");
      assert.match(
        holdout?.detail ?? "",
        /without Moon's 12 tag\(s\): named 0\.89 → 0\.00/,
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
