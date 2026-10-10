/**
 * V2 explanation tests (synthetic only). Owned by U.
 *
 * Structured selections, code-rendered grounding, repair, and
 * deterministic fallback — stubbed transport, no network, no keys.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { LlmError } from "./llm-client.ts";
import {
  deterministicV2Explanation,
  proposeV2Explanation,
  toV2Explanation,
  type V2ExplanationPacket,
} from "./v2-explain.ts";

function packet(): V2ExplanationPacket {
  return {
    neighborhoods: [
      {
        id: "run:n1",
        memberNames: ["Shared Core Alpha", "Shared Core Beta"],
        memberIds: ["work:alpha", "work:beta"],
        sharedDescriptor: "urn:tag:genre:media:slow_burn",
        coverage: 2,
        corroboration: 1,
        supportingCount: 1,
      },
    ],
    allowedNames: ["Shared Core Alpha", "Shared Core Beta", "Moon"],
    interpretation: "A slow, lonely sci-fi story.",
  };
}

function valid() {
  return {
    explanations: [
      {
        neighborhoodId: "run:n1",
        label: {
          kind: "descriptor",
          descriptor: "urn:tag:genre:media:slow_burn",
        },
        adviceKey: "ask-for-reaction",
      },
    ],
  };
}

describe("toV2Explanation", () => {
  it("renders the frozen descriptor, relations and reviewed advice", () => {
    const [exp] = toV2Explanation(valid(), packet());
    assert.equal(exp.neighborhoodId, "run:n1");
    assert.equal(exp.source, "llm-grounded");
    assert.equal(exp.name, "urn:tag:genre:media:slow_burn");
    assert.equal(
      exp.whyInvestigate,
      "2 distinct reference aspects share 2 returned works, with additional supporting evidence. Ask people familiar with these works to react to the pitch or a sample.",
    );
  });

  it("renders selected member names only from ids within that neighborhood", () => {
    const [exp] = toV2Explanation(
      {
        explanations: [
          {
            neighborhoodId: "run:n1",
            label: { kind: "members", memberIds: ["work:beta", "work:alpha"] },
            adviceKey: "compare-connections",
          },
        ],
      },
      packet(),
    );
    assert.equal(exp.name, "Shared Core Alpha / Shared Core Beta");
    assert.match(exp.whyInvestigate, /which connections to the pitch hold up/);
  });

  it("keeps frozen neighborhood order, not the model's ordering", () => {
    const p = packet();
    p.neighborhoods.push({ ...p.neighborhoods[0], id: "run:n2" });
    const entries = [
      { ...valid().explanations[0], neighborhoodId: "run:n2" },
      valid().explanations[0],
    ];
    assert.deepEqual(
      toV2Explanation({ explanations: entries }, p).map(
        (e) => e.neighborhoodId,
      ),
      ["run:n1", "run:n2"],
    );
  });

  it("rejects invented, non-member, duplicate, empty, and overflowing member ids", () => {
    for (const memberIds of [
      ["work:invented"],
      ["Moon"],
      ["Shared Core Alpha"],
      ["work:alpha", "work:alpha"],
      [],
      ["work:alpha", "work:beta", "work:gamma"],
      [null],
    ]) {
      assert.throws(
        () =>
          toV2Explanation(
            {
              explanations: [
                {
                  neighborhoodId: "run:n1",
                  label: { kind: "members", memberIds },
                  adviceKey: "test-sample",
                },
              ],
            },
            packet(),
          ),
        LlmError,
      );
    }
  });

  it("rejects a member id from another neighborhood even if its name is allowed", () => {
    const p = packet();
    p.neighborhoods.push({
      ...p.neighborhoods[0],
      id: "run:n2",
      memberIds: ["other:alpha", "other:beta"],
    });
    assert.throws(
      () =>
        toV2Explanation(
          {
            explanations: [
              {
                neighborhoodId: "run:n1",
                label: { kind: "members", memberIds: ["other:alpha"] },
                adviceKey: "test-sample",
              },
              { ...valid().explanations[0], neighborhoodId: "run:n2" },
            ],
          },
          p,
        ),
      LlmError,
    );
  });

  it("rejects invented or absent descriptor selections", () => {
    const changed = valid();
    changed.explanations[0].label.descriptor = "Slow-burn space stories";
    assert.throws(() => toV2Explanation(changed, packet()), LlmError);
    const p = packet();
    p.neighborhoods[0].sharedDescriptor = null;
    assert.throws(() => toV2Explanation(valid(), p), LlmError);
  });

  it("rejects unknown fields and free prose at every level", () => {
    const choice = valid().explanations[0];
    for (const data of [
      { ...valid(), prose: "Invented Composer" },
      { explanations: [{ ...choice, name: "Invented Composer" }] },
      { explanations: [{ ...choice, whyInvestigate: "Fans gather at Moon." }] },
      {
        explanations: [
          {
            ...choice,
            label: { ...choice.label, relation: "Fans gather at Moon." },
          },
        ],
      },
      {
        explanations: [
          {
            ...choice,
            label: { kind: "members", memberIds: ["work:alpha"], name: "Moon" },
          },
        ],
      },
    ]) {
      assert.throws(() => toV2Explanation(data, packet()), LlmError);
    }
  });

  it("rejects unreviewed advice and invalid label kinds", () => {
    const badAdvice = valid();
    badAdvice.explanations[0].adviceKey = "Fans gather at Moon.";
    assert.throws(() => toV2Explanation(badAdvice, packet()), LlmError);
    badAdvice.explanations[0].adviceKey = "toString";
    assert.throws(() => toV2Explanation(badAdvice, packet()), LlmError);
    const badKind = valid();
    badKind.explanations[0].label.kind = "prose";
    assert.throws(() => toV2Explanation(badKind, packet()), LlmError);
  });

  it("allows descriptor-only legacy packets but never synthesizes missing member ids", () => {
    const p = packet();
    delete p.neighborhoods[0].memberIds;
    assert.equal(toV2Explanation(valid(), p)[0].source, "llm-grounded");
    assert.throws(
      () =>
        toV2Explanation(
          {
            explanations: [
              {
                neighborhoodId: "run:n1",
                label: { kind: "members", memberIds: ["work:alpha"] },
                adviceKey: "test-sample",
              },
            ],
          },
          p,
        ),
      LlmError,
    );
  });

  it("rejects ambiguous id/name alignment in the frozen input", () => {
    const p = packet();
    p.neighborhoods[0].memberIds = ["work:alpha"];
    assert.throws(() => toV2Explanation(valid(), p), LlmError);
    p.neighborhoods[0].memberIds = ["work:alpha", "work:alpha"];
    assert.throws(() => toV2Explanation(valid(), p), LlmError);
  });

  it("rejects unknown or missing neighborhood ids", () => {
    assert.throws(
      () =>
        toV2Explanation(
          {
            explanations: [
              { ...valid().explanations[0], neighborhoodId: "run:evil" },
            ],
          },
          packet(),
        ),
      LlmError,
    );
    assert.throws(
      () => toV2Explanation({ explanations: [] }, packet()),
      LlmError,
    );
    const p = packet();
    p.neighborhoods.push({ ...p.neighborhoods[0], id: "run:n2" });
    assert.throws(
      () =>
        toV2Explanation(
          { explanations: [valid().explanations[0], valid().explanations[0]] },
          p,
        ),
      LlmError,
    );
  });

  it("rejects quoted titles outside the evidence", () => {
    assert.throws(
      () =>
        toV2Explanation(
          {
            explanations: [
              {
                neighborhoodId: "run:n1",
                name: 'Fans of "Invented Blockbuster"',
                whyInvestigate: "Worth a look.",
              },
            ],
          },
          packet(),
        ),
      LlmError,
    );
  });

  it("rejects invented names regardless of quote convention", () => {
    for (const name of [
      "Fans of Invented Composer",
      "Fans of 'Invented Composer'",
      "Fans of ‘Invented Composer’",
      "Fans of “Invented Composer”",
    ]) {
      assert.throws(
        () =>
          toV2Explanation(
            {
              explanations: [
                {
                  neighborhoodId: "run:n1",
                  name,
                  whyInvestigate:
                    "Worth asking people familiar with these works.",
                },
              ],
            },
            packet(),
          ),
        LlmError,
        name,
      );
    }
  });

  it("rejects invented relationships even when every named entity is allowed", () => {
    assert.throws(
      () =>
        toV2Explanation(
          {
            explanations: [
              {
                neighborhoodId: "run:n1",
                name: "Shared Core Alpha",
                whyInvestigate:
                  "Fans of Shared Core Alpha gather at Moon. Start reaching them there.",
              },
            ],
          },
          packet(),
        ),
      LlmError,
    );
  });

  it("rejects demographic, market, and success claims", () => {
    for (const why of [
      "Millennials will love this pattern.",
      "A market size of 2 million listeners awaits.",
      "This guarantees box office success.",
      "An audience aged 25 to 34 is proven here.",
    ]) {
      assert.throws(
        () =>
          toV2Explanation(
            {
              explanations: [
                {
                  neighborhoodId: "run:n1",
                  name: "Label",
                  whyInvestigate: why,
                },
              ],
            },
            packet(),
          ),
        LlmError,
        why,
      );
    }
  });

  it("rejects missing selections and overlong rendered metadata", () => {
    const p = packet();
    p.neighborhoods[0].sharedDescriptor = "x".repeat(121);
    const selection = valid();
    selection.explanations[0].label.descriptor = "x".repeat(121);
    assert.throws(() => toV2Explanation(selection, p), LlmError);
    assert.throws(
      () =>
        toV2Explanation(
          {
            explanations: [
              { neighborhoodId: "run:n1", name: "", whyInvestigate: "Fine." },
            ],
          },
          packet(),
        ),
      LlmError,
    );
    assert.throws(
      () =>
        toV2Explanation(
          {
            explanations: [
              {
                neighborhoodId: "run:n1",
                name: "Fine",
                whyInvestigate: "x".repeat(501),
              },
            ],
          },
          packet(),
        ),
      LlmError,
    );
  });
});

describe("proposeV2Explanation", () => {
  it("returns validated words in one call", async () => {
    const out = await proposeV2Explanation(packet(), async () =>
      JSON.stringify(valid()),
    );
    assert.equal(out.llmCalls, 1);
    assert.equal(out.explanations[0].source, "llm-grounded");
  });

  it("runs one structured repair, then succeeds", async () => {
    let calls = 0;
    const out = await proposeV2Explanation(packet(), async () => {
      calls += 1;
      return calls === 1
        ? JSON.stringify({ explanations: [] })
        : JSON.stringify(valid());
    });
    assert.equal(calls, 2);
    assert.equal(out.llmCalls, 2);
    assert.equal(out.explanations.length, 1);
  });

  it("repairs arbitrary prose into a constrained selection", async () => {
    let calls = 0;
    const out = await proposeV2Explanation(packet(), async (messages) => {
      calls += 1;
      if (calls === 1) {
        const input = JSON.parse(messages[1].content);
        assert.deepEqual(input.neighborhoods[0].members, [
          { id: "work:alpha", name: "Shared Core Alpha" },
          { id: "work:beta", name: "Shared Core Beta" },
        ]);
        return JSON.stringify({
          explanations: [
            {
              neighborhoodId: "run:n1",
              name: "Invented Composer",
              whyInvestigate: "Fans gather at Moon.",
            },
          ],
        });
      }
      assert.match(messages[2].content, /failed validation/);
      return JSON.stringify(valid());
    });
    assert.equal(out.llmCalls, 2);
    assert.equal(out.explanations[0].name, "urn:tag:genre:media:slow_burn");
  });

  it("repairs free prose surrounding an otherwise valid selection", async () => {
    let calls = 0;
    const out = await proposeV2Explanation(packet(), async () => {
      calls += 1;
      return calls === 1
        ? `Fans gather at an invented channel.\n${JSON.stringify(valid())}`
        : JSON.stringify(valid());
    });
    assert.equal(calls, 2);
    assert.equal(out.llmCalls, 2);
    assert.doesNotMatch(out.explanations[0].whyInvestigate, /invented channel/);
  });

  it("throws when both attempts fail validation", async () => {
    await assert.rejects(
      proposeV2Explanation(packet(), async () =>
        JSON.stringify({ explanations: [] }),
      ),
      LlmError,
    );
  });
});

describe("deterministicV2Explanation", () => {
  it("labels from frozen counts with advice, never new claims", () => {
    const [exp] = deterministicV2Explanation(packet());
    assert.equal(exp.source, "deterministic");
    assert.equal(exp.name, "urn:tag:genre:media:slow_burn");
    assert.ok(exp.whyInvestigate.includes("2 distinct reference aspects"));
    assert.ok(exp.whyInvestigate.includes("additional supporting evidence"));
  });

  it("uses bounded overlap labels for overlong descriptors", () => {
    const p = packet();
    p.neighborhoods[0].sharedDescriptor = "x".repeat(121);
    assert.equal(
      deterministicV2Explanation(p)[0].name,
      "Reference overlap (2 works)",
    );
  });

  it("falls back to reference overlap without a shared descriptor", () => {
    const p = packet();
    p.neighborhoods[0].sharedDescriptor = null;
    const [exp] = deterministicV2Explanation(p);
    assert.ok(exp.name.includes("Reference overlap"));
  });
});
