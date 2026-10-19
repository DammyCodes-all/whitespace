import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { WorkType } from "../types.ts";
import { resolvePitchTags, semanticTagsEnabled } from "./resolve-tags.ts";

const FILM: WorkType = "film";

/** Mock mode (no key in the test process) answers empty, so every word
 *  misses — which is exactly the path the semantic pass exists for. */
function withSemantic<T>(value: string | undefined, run: () => Promise<T>) {
  const saved = process.env.QLOO_SEMANTIC_TAGS;
  if (value === undefined) delete process.env.QLOO_SEMANTIC_TAGS;
  else process.env.QLOO_SEMANTIC_TAGS = value;
  return run().finally(() => {
    if (saved === undefined) delete process.env.QLOO_SEMANTIC_TAGS;
    else process.env.QLOO_SEMANTIC_TAGS = saved;
  });
}

function semanticFlags(params: Record<string, string>[]): boolean[] {
  return params.map((p) => p["feature.semantic_search"] === "true");
}

describe("semanticTagsEnabled", () => {
  it("is on by default and off only when explicitly disabled", async () => {
    await withSemantic(undefined, async () => {
      assert.equal(semanticTagsEnabled(), true);
    });
    for (const off of ["off", "OFF", "false", "0"]) {
      await withSemantic(off, async () => {
        assert.equal(semanticTagsEnabled(), false);
      });
    }
    for (const on of ["on", "true", "1", "yes"]) {
      await withSemantic(on, async () => {
        assert.equal(semanticTagsEnabled(), true);
      });
    }
  });
});

describe("resolvePitchTags semantic pass", () => {
  it("retries a plain miss with semantic search, scoped the same way", async () => {
    await withSemantic(undefined, async () => {
      const out = await resolvePitchTags(["lonely"], FILM);
      assert.equal(out.calls.length, 2);
      const [plain, semantic] = out.calls.map((c) => c.params);
      assert.equal(plain["feature.semantic_search"], undefined);
      assert.equal(semantic["feature.semantic_search"], "true");
      // Namespaces must survive the flag, or ids stop sharing a
      // namespace with audience tastes (§6.6).
      assert.equal(semantic["filter.tag.types"], plain["filter.tag.types"]);
      // Raised from 5 so an exact hit is actually in the page.
      assert.equal(plain.take, "20");
    });
  });

  it("runs one call per word when the semantic pass is off", async () => {
    await withSemantic("off", async () => {
      const out = await resolvePitchTags(["lonely", "grief"], FILM);
      assert.equal(out.calls.length, 2);
      assert.deepEqual(semanticFlags(out.calls.map((c) => c.params)), [
        false,
        false,
      ]);
      assert.deepEqual(out.notFoundWords, ["lonely", "grief"]);
    });
  });

  it("folds plurals into one word before spending calls", async () => {
    await withSemantic("off", async () => {
      const out = await resolvePitchTags(
        ["vampire", "Vampires", "vampire"],
        FILM,
      );
      assert.equal(out.calls.length, 1);
      assert.deepEqual(out.notFoundWords, ["vampire"]);
    });
  });

  it("never reports a semantic word without a call backing it", async () => {
    await withSemantic(undefined, async () => {
      const out = await resolvePitchTags(["lonely"], FILM);
      // Mock Qloo finds nothing, so nothing may claim a match.
      assert.deepEqual(out.tags, []);
      assert.deepEqual(out.semanticWords, []);
      assert.deepEqual(out.qlooNames, {});
      assert.equal(out.coverage, 0);
    });
  });

  it("keeps empty input vacuous: coverage 1, no calls", async () => {
    const out = await resolvePitchTags([], FILM);
    assert.deepEqual(out.calls, []);
    assert.deepEqual(out.tags, []);
    assert.deepEqual(out.qlooNames, {});
    assert.equal(out.coverage, 1);
  });
});
