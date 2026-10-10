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
