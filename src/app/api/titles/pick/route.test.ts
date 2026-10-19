/**
 * POST /api/titles/pick: validation, kept-id mapping, fail-open.
 * Mocks only: synthetic env, stubbed transport — no request ever
 * leaves the process and no real key is read.
 */
import assert from "node:assert/strict";
import type { TestContext } from "node:test";
import { describe, it } from "node:test";
import { POST } from "./route.ts";

const SAVED_GROQ = process.env.GROQ_API_KEY;
const SAVED_OPENROUTER = process.env.OPENROUTER_API_KEY;
const SAVED_MODEL = process.env.GROQ_MODEL;
const SAVED_FETCH = globalThis.fetch;

function clearLlmEnv(): void {
  delete process.env.GROQ_API_KEY;
  delete process.env.OPENROUTER_API_KEY;
  delete process.env.GROQ_MODEL;
}

/** Fake Groq key plus a chat-completions stub returning canned JSON. */
function stubChat(
  t: TestContext,
  content: string,
  onBody?: (body: Record<string, unknown>) => void,
): void {
  process.env.GROQ_API_KEY = "synthetic-test-key";
  delete process.env.OPENROUTER_API_KEY;
  t.mock.method(globalThis, "fetch", (async (input: unknown, init: unknown) => {
    try {
      const raw = (init as { body?: unknown }).body;
      if (typeof raw === "string") {
        onBody?.(JSON.parse(raw) as Record<string, unknown>);
      }
    } catch {
      // Body inspection is best-effort; the response still stands.
    }
    void input;
    return new Response(
      JSON.stringify({ choices: [{ message: { content } }] }),
      { status: 200 },
    );
  }) as typeof fetch);
  t.after(() => {
    if (SAVED_GROQ === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = SAVED_GROQ;
    if (SAVED_OPENROUTER === undefined) {
      delete process.env.OPENROUTER_API_KEY;
    } else process.env.OPENROUTER_API_KEY = SAVED_OPENROUTER;
    if (SAVED_MODEL === undefined) delete process.env.GROQ_MODEL;
    else process.env.GROQ_MODEL = SAVED_MODEL;
    globalThis.fetch = SAVED_FETCH;
  });
  t.after(() => {
    clearLlmEnv();
    if (SAVED_GROQ !== undefined) process.env.GROQ_API_KEY = SAVED_GROQ;
    if (SAVED_OPENROUTER !== undefined) {
      process.env.OPENROUTER_API_KEY = SAVED_OPENROUTER;
    }
    if (SAVED_MODEL !== undefined) process.env.GROQ_MODEL = SAVED_MODEL;
  });
}

function post(body: unknown): Request {
  return new Request("http://localhost/api/titles/pick", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const CANDIDATES = [
  { qlooId: "id1", label: "school", sourceTitleName: "Parasyte" },
  { qlooId: "id2", label: "romance", sourceTitleName: "Parasyte" },
];

describe("POST /api/titles/pick", () => {
  it("400s on an empty pitch or missing candidates", async (t) => {
    stubChat(t, '{"kept":["id1"]}');
    for (const body of [
      { pitchText: "   ", candidates: CANDIDATES },
      { pitchText: "a school story", candidates: [] },
      { pitchText: "a school story" },
      { candidates: CANDIDATES },
    ]) {
      const res = await POST(post(body));
      assert.equal(res.status, 400);
    }
  });

  it("returns the model's kept subset, dropping the ones it never lists", async (t) => {
    let seenMessages: unknown = null;
    stubChat(t, '{"kept":["id1"]}', (body) => {
      seenMessages = (body as { messages?: unknown }).messages;
    });
    const res = await POST(
      post({ pitchText: "a school story", candidates: CANDIDATES }),
    );
    assert.equal(res.status, 200);
    const data = (await res.json()) as { keptIds?: string[] };
    // A candidate the model never lists is a judgment (cut), shown in
    // the cut-gifts row with everything restoreable — not a failure.
    assert.deepEqual(data.keptIds, ["id1"]);
    assert.ok(Array.isArray(seenMessages));
  });

  it("fails OPEN on an id the model was not offered (typo restores intent)", async (t) => {
    stubChat(t, '{"kept":["id1","nope"]}');
    const res = await POST(
      post({ pitchText: "a school story", candidates: CANDIDATES }),
    );
    assert.equal(res.status, 200);
    const data = (await res.json()) as { keptIds?: string[] };
    // The model's full intent ("id1" kept) survives its own typo: the
    // not-offered id aborts the pass, so both candidates stay.
    const kept = new Set(data.keptIds ?? []);
    assert.ok(kept.has("id1"));
    assert.ok(kept.has("id2"));
  });

  it("fails open with every candidate when no LLM key is set", async (t) => {
    clearLlmEnv();
    t.after(() => {
      if (SAVED_GROQ !== undefined) process.env.GROQ_API_KEY = SAVED_GROQ;
      if (SAVED_OPENROUTER !== undefined) {
        process.env.OPENROUTER_API_KEY = SAVED_OPENROUTER;
      }
    });
    const res = await POST(
      post({ pitchText: "a school story", candidates: CANDIDATES }),
    );
    assert.equal(res.status, 200);
    const data = (await res.json()) as { keptIds?: string[] };
    assert.deepEqual(data.keptIds, ["id1", "id2"]);
  });
});
