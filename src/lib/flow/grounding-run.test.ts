import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { checkGrounding } from "../policy/grounding.ts";
import type { RelatedResult } from "../qloo/related.ts";
import type { AudienceTastes } from "../scoring/fit.ts";
import type { Audience } from "../types.ts";
import {
  audienceTitleIds,
  groundAudiences,
  groundRelated,
  groundTags,
  mergeGrounding,
  relatedEntityIds,
  tasteTagIds,
} from "./grounding-run.ts";

function audience(id: string, titleIds: string[]): Audience {
  return {
    id,
    kind: "hypothesis",
    name: id,
    titles: titleIds.map((qlooId) => ({
      query: qlooId,
      qlooId,
      name: qlooId,
      type: "urn:entity:movie",
    })),
    notFoundTitles: [],
  };
}

function tastes(id: string, tagIds: string[], failed = false): AudienceTastes {
  return { audienceId: id, tagIds, tagNames: tagIds, failed };
}

function related(entityIds: string[]): RelatedResult {
  return {
    kind: "person",
    call: null,
    items: entityIds.map((entityId, index) => ({
      entityId,
      name: entityId,
      kind: "person",
      affinityRank: index + 1,
      callId: "call-1",
    })),
  };
}

describe("collectors", () => {
  it("collects audience title ids without duplicates", () => {
    assert.deepEqual(
      audienceTitleIds([
        audience("hyp", ["urn:title:moon", "urn:title:dune"]),
        audience("rival", ["urn:title:dune", "urn:title:arrival"]),
      ]),
      ["urn:title:moon", "urn:title:dune", "urn:title:arrival"],
    );
  });

  it("skips failed taste lists and dedupes tag ids", () => {
    assert.deepEqual(
      tasteTagIds([
        [tastes("a", ["urn:tag:one", "urn:tag:two"]), tastes("b", [], true)],
        [tastes("c", ["urn:tag:two", "urn:tag:three"])],
      ]),
      ["urn:tag:one", "urn:tag:two", "urn:tag:three"],
    );
  });

  it("collects reach entity ids from every audience", () => {
    assert.deepEqual(
      relatedEntityIds({
        hyp: [related(["id:person-1", "id:person-2"])],
        rival: [related(["id:brand-1"])],
      }),
      ["id:person-1", "id:person-2", "id:brand-1"],
    );
  });
});

describe("stripping", () => {
  it("drops a fabricated tag before it can score", () => {
    const tags = [{ qlooTagId: "urn:tag:real" }, { qlooTagId: "urn:tag:fake" }];
    const out = groundTags(
      tags,
      (tag) => tag.qlooTagId,
      new Set(["urn:tag:real"]),
    );
    assert.deepEqual(out.kept, [{ qlooTagId: "urn:tag:real" }]);
    assert.deepEqual(out.removed, ["urn:tag:fake"]);
  });

  it("strips a fabricated title from the row but keeps the row", () => {
    const out = groundAudiences(
      [audience("hyp", ["urn:title:moon", "urn:title:invented"])],
      new Set(["urn:title:moon"]),
    );
    assert.equal(out.kept.length, 1);
    assert.deepEqual(
      out.kept[0]?.titles.map((title) => title.qlooId),
      ["urn:title:moon"],
    );
    assert.deepEqual(out.removed, ["urn:title:invented"]);
  });

  it("strips a fabricated reach name from the card", () => {
    const out = groundRelated(
      { hyp: [related(["id:real", "id:invented"])] },
      new Set(["id:real"]),
    );
    assert.deepEqual(
      out.byAudienceId.hyp?.[0]?.items.map((item) => item.entityId),
      ["id:real"],
    );
    assert.deepEqual(out.removed, ["id:invented"]);
  });
});

describe("run check", () => {
  it("strips a fabricated title and tag before display, and reports both", () => {
    const knownTitles = new Set(["urn:title:moon"]);
    const knownTags = new Set(["urn:tag:real"]);
    const outputTitles = ["urn:title:moon", "urn:title:invented"];
    const outputTags = ["urn:tag:real", "urn:tag:invented"];
    const check = checkGrounding(
      outputTitles,
      outputTags,
      [...knownTitles],
      [...knownTags],
    );
    assert.equal(check.ok, false);

    const titles = groundAudiences(
      [audience("hyp", outputTitles)],
      knownTitles,
    );
    const tags = groundTags(
      outputTags.map((qlooTagId) => ({ qlooTagId })),
      (tag) => tag.qlooTagId,
      knownTags,
    );
    const merged = mergeGrounding(check, titles.removed, tags.removed);

    assert.deepEqual(
      titles.kept[0]?.titles.map((title) => title.qlooId),
      ["urn:title:moon"],
    );
    assert.deepEqual(tags.kept, [{ qlooTagId: "urn:tag:real" }]);
    assert.deepEqual(merged.ungroundedTitles, ["urn:title:invented"]);
    assert.deepEqual(merged.ungroundedTags, ["urn:tag:invented"]);
    assert.equal(merged.ok, false);
  });

  it("reports the removed ids as a failure after the output is cleaned", () => {
    const check = checkGrounding(
      ["urn:title:moon"],
      ["urn:tag:real"],
      ["urn:title:moon"],
      ["urn:tag:real"],
    );
    const merged = mergeGrounding(check, [], ["urn:tag:fake"]);
    assert.equal(merged.ok, false);
    assert.deepEqual(merged.ungroundedTags, ["urn:tag:fake"]);
  });

  it("stays ok when nothing was stripped", () => {
    const check = checkGrounding(
      ["urn:title:moon"],
      ["urn:tag:real"],
      ["urn:title:moon"],
      ["urn:tag:real"],
    );
    assert.equal(mergeGrounding(check, [], []).ok, true);
  });
});
