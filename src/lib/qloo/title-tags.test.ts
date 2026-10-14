/**
 * buildTitleTagPool: synthetic tastes only, no fetch. Each case pins
 * one rule: base extraction + cap, dedupe, generic cut, supplement,
 * pickedIds filter.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AudienceTastes } from "../scoring/fit.ts";
import {
  buildTitleTagPool,
  GENERIC_CONTROL_SHARE,
  TITLE_TAG_TOP_N,
} from "./title-tags.ts";

function tastes(
  audienceId: string,
  tagIds: string[],
  failed = false,
): AudienceTastes {
  return {
    audienceId,
    tagIds,
    tagNames: tagIds.map((id) => `name-of-${id}`),
    ...(failed ? { failed: true } : {}),
  };
}

function named(titleId: string, tagIds: string[], failed = false) {
  return {
    tastes: tastes(`title:${titleId}`, tagIds, failed),
    titleId,
    titleName: `Title ${titleId}`,
  };
}

const ids = (prefix: string, n: number): string[] =>
  Array.from({ length: n }, (_, i) => `urn:tag:${prefix}${i}`);

describe("buildTitleTagPool", () => {
  it("takes the top N labels per named title with sourceTitleId kept", () => {
    const pool = buildTitleTagPool({
      namedTastes: [named("t1", ids("a", TITLE_TAG_TOP_N + 5))],
      pitchMatchedTags: [],
      controlTastes: [],
      pickedIds: [],
    });
    assert.equal(pool.length, TITLE_TAG_TOP_N);
    assert.ok(
      pool.every(
        (c) =>
          typeof c.source === "object" &&
          c.source.titleId === "t1" &&
          c.sourceTitleName === "Title t1",
      ),
    );
    assert.equal(pool[0]?.qlooTagId, "urn:tag:a0");
    assert.equal(pool[0]?.label, "name-of-urn:tag:a0");
  });

  it("dedupes across titles, first source wins", () => {
    const pool = buildTitleTagPool({
      namedTastes: [
        named("t1", ["urn:tag:shared", "urn:tag:only1"]),
        named("t2", ["urn:tag:shared", "urn:tag:only2"]),
      ],
      pitchMatchedTags: [],
      controlTastes: [],
      pickedIds: [],
    });
    const shared = pool.filter((c) => c.qlooTagId === "urn:tag:shared");
    assert.equal(shared.length, 1);
    assert.deepEqual(shared[0]?.source, { titleId: "t1" });
    assert.equal(pool.length, 3);
  });

  it("cuts candidates held by at least half the control lists", () => {
    assert.equal(GENERIC_CONTROL_SHARE, 0.5);
    const pool = buildTitleTagPool({
      namedTastes: [
        named("t1", ["urn:tag:wide", "urn:tag:narrow", "urn:tag:rare"]),
      ],
      pitchMatchedTags: [],
      controlTastes: [
        tastes("c1", ["urn:tag:wide", "urn:tag:narrow"]),
        tastes("c2", ["urn:tag:wide"]),
        tastes("c3", ["urn:tag:narrow"]),
        tastes("c4", ["urn:tag:other"]),
      ],
      pickedIds: [],
    });
    const kept = pool.map((c) => c.qlooTagId);
    // wide: 2/4 held -> cut. narrow: 2/4 held -> cut. rare: 0/4 -> kept.
    assert.deepEqual(kept, ["urn:tag:rare"]);
  });

  it("failed control lists hold nothing but still count below the cut", () => {
    const pool = buildTitleTagPool({
      namedTastes: [named("t1", ["urn:tag:solo"])],
      pitchMatchedTags: [],
      controlTastes: [tastes("c1", [], true), tastes("c2", [], true)],
      pickedIds: [],
    });
    assert.deepEqual(
      pool.map((c) => c.qlooTagId),
      ["urn:tag:solo"],
    );
  });

  it("keeps everything when there are no control lists", () => {
    const pool = buildTitleTagPool({
      namedTastes: [named("t1", ["urn:tag:a"])],
      pitchMatchedTags: [{ qlooTagId: "urn:tag:b", label: "b" }],
      controlTastes: [],
      pickedIds: [],
    });
    assert.deepEqual(
      pool.map((c) => c.qlooTagId),
      ["urn:tag:a", "urn:tag:b"],
    );
  });

  it("supplements with pitch tags sourced pitch, skipping dupes", () => {
    const pool = buildTitleTagPool({
      namedTastes: [named("t1", ["urn:tag:shared"])],
      pitchMatchedTags: [
        { qlooTagId: "urn:tag:shared", label: "shared word" },
        { qlooTagId: "urn:tag:pitch", label: "pitch word" },
      ],
      controlTastes: [],
      pickedIds: [],
    });
    assert.equal(pool.length, 2);
    const pitch = pool.find((c) => c.qlooTagId === "urn:tag:pitch");
    assert.equal(pitch?.source, "pitch");
    assert.equal(pitch?.label, "pitch word");
    // The title's copy wins the shared id, not the pitch word.
    assert.equal(
      pool.find((c) => c.qlooTagId === "urn:tag:shared")?.label,
      "name-of-urn:tag:shared",
    );
  });

  it("skips failed named lists and falls back to the id without names", () => {
    const pool = buildTitleTagPool({
      namedTastes: [
        {
          tastes: tastes("t0", ["urn:tag:x"], true),
          titleId: "t0",
          titleName: "T0",
        },
        {
          tastes: { audienceId: "t1", tagIds: ["urn:tag:y"] },
          titleId: "t1",
          titleName: "T1",
        },
      ],
      pitchMatchedTags: [],
      controlTastes: [],
      pickedIds: [],
    });
    assert.deepEqual(
      pool.map((c) => c.qlooTagId),
      ["urn:tag:y"],
    );
    assert.equal(pool[0]?.label, "urn:tag:y");
  });

  it("keeps only pickedIds when a selection was confirmed", () => {
    const base = {
      namedTastes: [named("t1", ["urn:tag:a", "urn:tag:b"])],
      pitchMatchedTags: [{ qlooTagId: "urn:tag:c", label: "c" }],
      controlTastes: [],
    };
    const all = buildTitleTagPool({ ...base, pickedIds: [] });
    assert.equal(all.length, 3);
    const picked = buildTitleTagPool({
      ...base,
      pickedIds: ["urn:tag:c", "urn:tag:a", "urn:tag:unknown"],
    });
    assert.deepEqual(
      picked.map((c) => c.qlooTagId),
      ["urn:tag:a", "urn:tag:c"],
    );
  });
});
