/**
 * demo-fetch: every OrbFlow route answers from fixtures, unknown routes
 * pass through. Pins the echo behaviour (check mirrors typed titles,
 * suggestions respect excludes, run echoes the pitch).
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { demoResponseFor } from "./demo-fetch.ts";

describe("demoResponseFor", () => {
  it("answers tags with the fixture set", () => {
    const hit = demoResponseFor("/api/tags", { pitchText: "hi" });
    assert.ok(hit !== null && hit.status === 200);
    const json = hit.json as { tags: unknown[]; workType: string };
    assert.ok(json.tags.length > 0 && json.workType === "film");
  });

  it("echoes checked titles back as resolved", () => {
    const hit = demoResponseFor("/api/titles/check", {
      titles: ["Moon", "Arrival"],
      workType: "film",
    });
    const json = hit?.json as {
      resolved: { query: string; name: string; qlooId: string }[];
      notFound: string[];
    };
    assert.deepEqual(
      json.resolved.map((r) => r.name),
      ["Moon", "Arrival"],
    );
    assert.deepEqual(json.notFound, []);
  });

  it("sources gifts to the first checked title", () => {
    const hit = demoResponseFor("/api/titles/tags", { titles: ["Dune"] });
    const json = hit?.json as {
      tags: { sourceTitleName: string }[];
      note: string;
    };
    assert.ok(json.tags.length > 0);
    assert.ok(json.tags.every((t) => t.sourceTitleName === "Dune"));
    assert.equal(json.note, "ok");
  });

  it("keeps every pick candidate", () => {
    const hit = demoResponseFor("/api/titles/pick", {
      candidates: [{ qlooId: "a" }, { qlooId: "b" }],
    });
    assert.deepEqual((hit?.json as { keptIds: string[] }).keptIds, ["a", "b"]);
  });

  it("filters suggestions against excludes", () => {
    const hit = demoResponseFor("/api/titles/related", {
      entityIds: ["demo-title-0"],
      excludeNames: ["Moon"],
    });
    const json = hit?.json as { suggestions: string[] };
    assert.ok(!json.suggestions.includes("Moon"));
    assert.ok(json.suggestions.includes("Arrival"));
  });

  it("echoes the run pitch into the fixture result", () => {
    const hit = demoResponseFor("/api/flow", {
      pitchText: "my pitch",
      workType: "film",
      tags: [],
      similarTitles: ["Moon"],
      pickedTagIds: [],
    });
    const json = hit?.json as {
      result: { pitch: string; verdict: string };
      steps: { id: string }[];
      stopped: boolean;
    };
    assert.equal(json.result.pitch, "my pitch");
    assert.ok(json.steps.length > 0 && json.stopped === false);
  });

  it("answers compare from fixtures", () => {
    const compare = demoResponseFor("/api/compare", {});
    assert.ok((compare?.json as { chatbot: object }).chatbot !== null);
  });

  it("passes unknown routes through", () => {
    assert.equal(demoResponseFor("/api/nope", {}), null);
    assert.equal(demoResponseFor("/other", {}), null);
  });
});
