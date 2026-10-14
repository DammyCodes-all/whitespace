/** Synthetic provider responses only: no API calls, real keys, or env-file reads. */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { setImmediate } from "node:timers/promises";
import {
  callChatCompletions,
  GROQ_URL,
  LlmError,
  type LlmExecutionContext,
} from "./llm-client.ts";

const messages = [{ role: "user" as const, content: "Synthetic pitch." }];
function response(content: string): Response {
  return Response.json({ choices: [{ message: { content } }] });
}

function complete(execution: LlmExecutionContext = {}): Promise<string> {
  return callChatCompletions(
    GROQ_URL,
    "synthetic-key",
    "synthetic-model",
    messages,
    "groq",
    execution,
  );
}

/** Fail quickly if an ignored abort leaves a promise pending, without real sleeps. */
function withinTurn(promise: Promise<unknown>): Promise<unknown> {
  return Promise.race([
    promise,
    setImmediate().then(() => {
      throw new Error("LLM request did not settle after cancellation/timeout.");
    }),
  ]);
}

describe("callChatCompletions execution", () => {
  it("counts each real fetch, including HTTP, network, and body failures", async (t) => {
    let attempts = 0;
    let fetches = 0;
    t.mock.method(globalThis, "fetch", async () => {
      fetches += 1;
      assert.equal(attempts, fetches);
      if (fetches === 1) return response("{} ");
      if (fetches === 2) return new Response(null, { status: 503 });
      if (fetches === 3) throw new Error("Synthetic network failure.");
      return new Response("invalid provider JSON");
    });
    const execution = {
      onAttempt: () => {
        attempts += 1;
      },
    };
    assert.equal(await complete(execution), "{} ");
    for (let i = 0; i < 3; i += 1) {
      await assert.rejects(complete(execution), LlmError);
    }
    assert.equal(attempts, 4);
    assert.equal(fetches, 4);
  });

  it("makes no fetch or attempt callback for an already-aborted signal", async (t) => {
    let attempts = 0;
    const fetch = t.mock.method(globalThis, "fetch", async () =>
      response("{}"),
    );
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(
      complete({
        signal: controller.signal,
        onAttempt: () => {
          attempts += 1;
        },
      }),
    );
    assert.equal(attempts, 0);
    assert.equal(fetch.mock.callCount(), 0);
  });

  it("does not fetch when the attempt hook refuses dispatch", async (t) => {
    const refused = new LlmError("Synthetic budget exhausted.", "budget", true);
    const fetch = t.mock.method(globalThis, "fetch", async () =>
      response("{}"),
    );
    await assert.rejects(
      complete({
        onAttempt: () => {
          throw refused;
        },
      }),
      (err) => err === refused,
    );
    assert.equal(fetch.mock.callCount(), 0);
  });

  it("links parent cancellation to an in-flight provider fetch", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    let providerSignal: AbortSignal | undefined;
    t.mock.method(globalThis, "fetch", (_url: unknown, init: RequestInit) => {
      providerSignal = init.signal ?? undefined;
      return new Promise<Response>((_resolve, reject) => {
        providerSignal?.addEventListener(
          "abort",
          () => reject(new DOMException("Aborted", "AbortError")),
          { once: true },
        );
      });
    });
    const controller = new AbortController();
    const pending = complete({ signal: controller.signal });
    controller.abort();
    await assert.rejects(withinTurn(pending), /aborted|cancelled/i);
    assert.equal(providerSignal?.aborted, true);
  });

  it("bounds response parsing with the same parent abort signal", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    let providerSignal: AbortSignal | undefined;
    let parsingStarted: () => void = () => {};
    const parsing = new Promise<void>((resolve) => {
      parsingStarted = resolve;
    });
    t.mock.method(
      globalThis,
      "fetch",
      async (_url: unknown, init: RequestInit) => {
        providerSignal = init.signal ?? undefined;
        return {
          ok: true,
          json: () => {
            parsingStarted();
            return new Promise(() => {});
          },
        } as unknown as Response;
      },
    );
    const controller = new AbortController();
    const pending = complete({ signal: controller.signal });
    await parsing;
    controller.abort();
    await assert.rejects(withinTurn(pending), /aborted|cancelled/i);
    assert.equal(providerSignal?.aborted, true);
  });

  it("keeps the local 20-second timeout active during response parsing", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    let parsingStarted: () => void = () => {};
    const parsing = new Promise<void>((resolve) => {
      parsingStarted = resolve;
    });
    t.mock.method(
      globalThis,
      "fetch",
      async () =>
        ({
          ok: true,
          json: () => {
            parsingStarted();
            return new Promise(() => {});
          },
        }) as unknown as Response,
    );
    const pending = complete();
    await parsing;
    t.mock.timers.tick(20000);
    await assert.rejects(withinTurn(pending), /timed out/i);
  });

  it("bounds a stalled fetch even when the fetch mock ignores its signal", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    t.mock.method(globalThis, "fetch", () => new Promise<Response>(() => {}));
    const pending = complete();
    t.mock.timers.tick(20000);
    await assert.rejects(withinTurn(pending), /timed out/i);
  });

  it("honors a custom timeoutMs instead of the 20s default", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    t.mock.method(globalThis, "fetch", () => new Promise<Response>(() => {}));
    const raw = callChatCompletions(
      GROQ_URL,
      "synthetic-key",
      "synthetic-model",
      messages,
      "groq",
      { timeoutMs: 45000 },
    );
    let settled = false;
    void raw.then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      },
    );
    t.mock.timers.tick(20000);
    await setImmediate();
    assert.equal(settled, false);
    t.mock.timers.tick(25000);
    await assert.rejects(withinTurn(raw), /timed out/i);
  });

  it("keeps v1-style options and headers unchanged", async (t) => {
    t.mock.method(
      globalThis,
      "fetch",
      async (_url: unknown, init: RequestInit) => {
        const body = JSON.parse(String(init.body));
        assert.equal(body.temperature, 0.4);
        assert.equal(body.max_tokens, 800);
        assert.deepEqual(body.messages, messages);
        assert.equal(
          (init.headers as Record<string, string>)["X-Title"],
          "Synthetic app",
        );
        return response("{} ");
      },
    );
    assert.equal(
      await callChatCompletions(
        GROQ_URL,
        "synthetic-key",
        "model",
        messages,
        "groq",
        {
          temperature: 0.4,
          maxTokens: 800,
          extraHeaders: { "X-Title": "Synthetic app" },
        },
      ),
      "{} ",
    );
  });
});

describe("callChatCompletions JSON-validation retry", () => {
  it("retries once without response_format after a 400 json_validate failure", async (t) => {
    const bodies: Record<string, unknown>[] = [];
    const fetch = t.mock.method(
      globalThis,
      "fetch",
      async (_url: unknown, init: RequestInit) => {
        bodies.push(JSON.parse(String(init.body)) as Record<string, unknown>);
        if (bodies.length === 1) {
          return new Response(
            JSON.stringify({
              error: {
                message:
                  "Failed to validate JSON: json_validate_failed, constrained decoding stalled",
                type: "json_validate_failed",
                code: "json_validate_failed",
              },
            }),
            { status: 400 },
          );
        }
        return response('{"bridges":[]}');
      },
    );
    const content = await complete();
    assert.equal(content, '{"bridges":[]}');
    assert.equal(fetch.mock.callCount(), 2);
    assert.deepEqual((bodies[0] as Record<string, unknown>).response_format, {
      type: "json_object",
    });
    assert.ok(!("response_format" in (bodies[1] ?? {})));
    // Same prompt, same knobs — only the framing is dropped.
    assert.deepEqual(bodies[1]?.messages, bodies[0]?.messages);
    assert.equal(bodies[1]?.model, bodies[0]?.model);
    assert.equal(bodies[1]?.temperature, bodies[0]?.temperature);
    assert.equal(bodies[1]?.max_tokens, bodies[0]?.max_tokens);
  });

  it("still throws on a 400 without JSON-validation wording, with 1 fetch", async (t) => {
    const fetch = t.mock.method(
      globalThis,
      "fetch",
      async () =>
        new Response(
          JSON.stringify({ error: { message: "model not found" } }),
          { status: 400 },
        ),
    );
    await assert.rejects(complete(), LlmError);
    assert.equal(fetch.mock.callCount(), 1);
  });

  it("leaves non-400 failures unchanged (429 and 5xx, 1 fetch each)", async (t) => {
    let fetch = t.mock.method(
      globalThis,
      "fetch",
      async () => new Response("synthetic rate limit", { status: 429 }),
    );
    await assert.rejects(complete(), LlmError);
    assert.equal(fetch.mock.callCount(), 1);
    fetch.mock.restore();
    fetch = t.mock.method(
      globalThis,
      "fetch",
      async () => new Response("synthetic provider outage", { status: 500 }),
    );
    await assert.rejects(complete(), LlmError);
    assert.equal(fetch.mock.callCount(), 1);
  });
});
