/**
 * The two guards the 2026-10-20 back-test found (`docs/backtest-results.md`),
 * proven end to end through the flow.
 *
 * 1. §6.4 control exclusion: a control that shares ANY title with the
 *    named audience leaves the comparison field. The Horror seed holds
 *    "Get Out", so naming that film used to keep the subject film's own
 *    crowd in the field as an "unrelated" baseline.
 * 2. §6.7 fragility guard: a named audience that leans on one of its own
 *    gifts cannot read Strong fit.
 *
 * The Qloo surface is stubbed in-process: no network, no key, no quota.
 * Every number the run reports comes from the stub, so the assertions
 * are about our code, not about Qloo.
 */

import assert from "node:assert/strict";
import { describe, it, type TestContext } from "node:test";
import { clearControlCache } from "../qloo/control-cache.ts";
import { runFlowPitch } from "./run-flow.ts";

const PITCH = "A quiet science-fiction film about a lonely worker.";

/** Moon's tastes: 50 labels, the top 12 become the pool's title gifts. */
const HYP_TAGS = [
  "urn:tag:alpha",
  "urn:tag:beta",
  "urn:tag:gamma",
  ...Array.from({ length: 9 }, (_, i) => `urn:tag:f${i + 1}`),
  ...Array.from({ length: 38 }, (_, i) => `urn:tag:g${i}`),
];

/**
 * The rivals hold only the pitch tag, at rank 1: an honest low score on
 * the full pool, and the best score left once the title's gifts are
 * dropped.
 */
const RIVAL_TAGS = [
  "urn:tag:omega",
  ...Array.from({ length: 49 }, (_, i) => `urn:tag:v${i}`),
];

/** The strangers hold two pool tags: a low but measurable baseline. */
const FAR_TAGS = [
  "urn:tag:alpha",
  ...Array.from({ length: 39 }, (_, i) => `urn:tag:ff${i}`),
  "urn:tag:beta",
  ...Array.from({ length: 9 }, (_, i) => `urn:tag:fx${i}`),
];

/** Controls hold nothing from the pool: honest zeros, never the line. */
const CONTROL_TAGS = Array.from({ length: 50 }, (_, i) => `urn:tag:low${i}`);

const ids = (names: string[]) => names.map((id) => ({ tag_id: id, name: id }));

/**
 * Stub the whole Qloo surface for one run.
 *
 * - the named titles (`namedTitles`) answer with HYP_TAGS, so their top
 *   tastes are the pool's title gifts;
 * - the rivals (own domain plus the cross domains) answer with
 *   RIVAL_TAGS, which holds only the pitch tag;
 * - the strangers (the bottom of the own-domain ranking) answer with
 *   FAR_TAGS;
 * - every control answers with CONTROL_TAGS.
 */
function stubQloo(t: TestContext, namedTitles: string[]): void {
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
      let tags = CONTROL_TAGS;
      if (namedTitles.some((title) => entities.includes(`id:${title}`))) {
        tags = HYP_TAGS;
      } else if (
        entities.includes("id:mov-e5") ||
        entities.includes("id:mov-e6")
      ) {
        tags = FAR_TAGS;
      } else if (
        entities.some(
          (e) =>
            e.startsWith("id:mov-") ||
            e.startsWith("id:book-") ||
            e.startsWith("id:artist-"),
        )
      ) {
        tags = RIVAL_TAGS;
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
    // Discovery: the own domain carries a long tail so the strangers sit
    // at the bottom, unused by any rival.
    const isOwn = filterType === "urn:entity:movie";
    const count = isOwn ? 6 : 2;
    const tag = isOwn ? "mov" : filterType.replace("urn:entity:", "");
    const entities = Array.from({ length: count }, (_, i) => ({
      entity_id: `id:${tag}-e${i + 1}`,
      name: `Rival ${tag} ${i + 1}`,
    }));
    return new Response(JSON.stringify({ success: true, results: entities }), {
      status: 200,
    });
  }) as typeof fetch);
}

/** Synthetic Qloo key, no model keys, clean control cache, restored after. */
async function withQlooKey(run: () => Promise<void>): Promise<void> {
  const savedKey = process.env.QLOO_API_KEY;
  const savedGroq = process.env.GROQ_API_KEY;
  const savedRouter = process.env.OPENROUTER_API_KEY;
  process.env.QLOO_API_KEY = "synthetic-test-key";
  delete process.env.GROQ_API_KEY;
  delete process.env.OPENROUTER_API_KEY;
  clearControlCache();
  try {
    await run();
  } finally {
    if (savedKey === undefined) delete process.env.QLOO_API_KEY;
    else process.env.QLOO_API_KEY = savedKey;
    if (savedGroq === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = savedGroq;
    if (savedRouter === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = savedRouter;
    clearControlCache();
  }
}

describe("back-test guards through the flow", () => {
  it("caps a fragile named audience at Mixed fit and says why", async (t) => {
    await withQlooKey(async () => {
      stubQloo(t, ["Moon"]);
      const out = await runFlowPitch({
        pitchText: PITCH,
        workType: "film",
        similarTitles: ["Moon"],
        tags: [
          {
            label: "omega",
            qlooId: "urn:tag:omega",
            status: "matched",
          },
        ],
      });

      assert.equal(out.stopped, false);
      // The named audience is on top and clears the strangers line by a
      // wide margin, so without the guard this run would read Strong.
      const named = out.result.audiences.find((a) => a.role === "named");
      assert.ok(named?.score !== null && named?.score !== undefined);
      assert.ok((named?.score ?? 0) > 0.5);
      // The hold-out round is the back-test shape: dropping Moon's gifts
      // takes the named audience to zero while the field's best rises.
      const holdout = out.steps.find((s) => s.id === "holdout-1");
      assert.match(holdout?.detail ?? "", /named fit index 82 → 0/);
      // So the verdict is capped, and the reason travels with it.
      assert.equal(out.result.verdict, "mixed");
      assert.equal(out.result.fragile, true);
      assert.match(out.result.fragilityNote ?? "", /Moon/);
      // The ledger's verdict line reads the capped word, never the
      // measured one: a downgrade is never silent.
      assert.match(
        out.steps.find((s) => s.id === "verdict")?.detail ?? "",
        /^Mixed,/,
      );
      const fragilityStep = out.steps.find((s) => s.id === "fragility");
      assert.ok(fragilityStep !== undefined);
      assert.match(fragilityStep?.detail ?? "", /capped at Mixed fit/);
      // The capped verdict reaches one audience only: the runner-up
      // never cleared control, so no extra reach call is spent.
      assert.equal(out.result.reach?.length, 1);
    });
  });

  it("drops a control that shares a title with the named audience", async (t) => {
    await withQlooKey(async () => {
      // "Get Out" is one of the Horror control's three seeds, so the
      // comparison field would hold the film under test. The named
      // audience has three titles, so the old "more than a third" rule
      // saw one shared title in three and let the control stay.
      stubQloo(t, ["Get Out", "Moon", "Arrival"]);
      const out = await runFlowPitch({
        pitchText: PITCH,
        workType: "film",
        similarTitles: ["Get Out", "Moon", "Arrival"],
        tags: [
          {
            label: "omega",
            qlooId: "urn:tag:omega",
            status: "matched",
          },
        ],
      });

      assert.equal(out.stopped, false);
      const controlsStep = out.steps.find((s) => s.id === "controls");
      assert.match(
        controlsStep?.detail ?? "",
        /1 excluded as too close \(shared titles\)/,
      );
    });
  });
});
