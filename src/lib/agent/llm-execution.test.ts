/** Synthetic provider responses only: no API calls, real keys, or env-file reads. */
import assert from "node:assert/strict";
import { describe, it, type TestContext } from "node:test";
import { setImmediate } from "node:timers/promises";
import {
  callChatCompletions,
  GROQ_URL,
  LlmError,
  type LlmExecutionContext,
  OPENROUTER_URL,
} from "./llm-client.ts";
import { proposeV2Brief } from "./v2-brief.ts";
import {
  proposeV2Explanation,
  type V2ExplanationPacket,
} from "./v2-explain.ts";

const messages = [{ role: "user" as const, content: "Synthetic pitch." }];
const brief = {
  interpretation: "My reading: a quiet film.",
  aspects: [{ facet: "tone", excerpt: "quiet", interpretation: "Quiet tone." }],
  constraints: [],
  contrasts: [],
  unrepresentable: [],
  references: [],
};
const packet: V2ExplanationPacket = {
  neighborhoods: [
    {
      id: "group:synthetic",
      memberIds: ["member:a", "member:b"],
      memberNames: ["Synthetic Alpha", "Synthetic Beta"],
      sharedDescriptor: "quiet",
      coverage: 2,
      corroboration: 1,
      supportingCount: 0,
    },
  ],
  allowedNames: ["Synthetic Alpha", "Synthetic Beta"],
  interpretation: "My reading: a quiet film.",
};
const explanation = {
  explanations: [
    {
      neighborhoodId: "group:synthetic",
      label: { kind: "descriptor", descriptor: "quiet" },
      adviceKey: "ask-for-reaction",
    },
  ],
};

function response(content: string): Response {
  return Response.json({ choices: [{ message: { content } }] });
}

function syntheticProviders(t: TestContext): void {
  const original = process.env;
  process.env = {
    ...original,
    GROQ_API_KEY: "synthetic-groq-key",
    OPENROUTER_API_KEY: "synthetic-openrouter-key",
  };
  t.after(() => {
    process.env = original;
  });
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

for (const stage of ["brief", "explanation"] as const) {
  const valid = JSON.stringify(stage === "brief" ? brief : explanation);
  const invoke = (execution: LlmExecutionContext) =>
    stage === "brief"
      ? proposeV2Brief("A quiet film.", "film", undefined, execution)
      : proposeV2Explanation(packet, undefined, execution);

  describe(`V2 ${stage} provider execution`, () => {
    it("charges failed providers, fallback, and the structured repair individually", async (t) => {
      syntheticProviders(t);
      let attempts = 0;
      const urls: string[] = [];
      t.mock.method(globalThis, "fetch", async (url: string) => {
        urls.push(url);
        assert.equal(attempts, urls.length);
        if (urls.length === 1) return new Response(null, { status: 503 });
        if (urls.length === 2) return response("{}");
        if (urls.length === 3)
          throw new Error("Synthetic repair provider failure.");
        return response(valid);
      });
      const out = await invoke({
        onAttempt: () => {
          attempts += 1;
        },
      });
      assert.equal(attempts, 4);
      assert.deepEqual(urls, [
        GROQ_URL,
        OPENROUTER_URL,
        GROQ_URL,
        OPENROUTER_URL,
      ]);
      if ("llmCalls" in out) assert.equal(out.llmCalls, 2);
    });

    it("charges unsuccessful provider requests even when the stage throws", async (t) => {
      syntheticProviders(t);
      let attempts = 0;
      const fetch = t.mock.method(
        globalThis,
        "fetch",
        async () => new Response(null, { status: 503 }),
      );
      await assert.rejects(
        invoke({
          onAttempt: () => {
            attempts += 1;
          },
        }),
        LlmError,
      );
      assert.equal(attempts, 2);
      assert.equal(fetch.mock.callCount(), 2);
    });

    it("starts no provider request when the run is already aborted", async (t) => {
      syntheticProviders(t);
      let attempts = 0;
      const fetch = t.mock.method(globalThis, "fetch", async () =>
        response(valid),
      );
      const controller = new AbortController();
      controller.abort();
      await assert.rejects(
        invoke({
          signal: controller.signal,
          onAttempt: () => {
            attempts += 1;
          },
        }),
      );
      assert.equal(attempts, 0);
      assert.equal(fetch.mock.callCount(), 0);
    });

    it("aborts in flight without dispatching fallback or repair afterward", async (t) => {
      syntheticProviders(t);
      t.mock.timers.enable({ apis: ["setTimeout"] });
      const controller = new AbortController();
      let attempts = 0;
      const fetch = t.mock.method(
        globalThis,
        "fetch",
        (_url: unknown, init: RequestInit) => {
          return new Promise<Response>((_resolve, reject) => {
            init.signal?.addEventListener(
              "abort",
              () => reject(new DOMException("Aborted", "AbortError")),
              { once: true },
            );
          });
        },
      );
      const pending = invoke({
        signal: controller.signal,
        onAttempt: () => {
          attempts += 1;
        },
      });
      controller.abort();
      await assert.rejects(withinTurn(pending), /aborted|cancelled/i);
      await setImmediate();
      assert.equal(attempts, 1);
      assert.equal(fetch.mock.callCount(), 1);
    });

    it("forwards the exact execution context through both injected chat rounds", async () => {
      const execution = {
        signal: new AbortController().signal,
        onAttempt: () => {},
      };
      let calls = 0;
      const chat = async (
        _messages: unknown,
        context?: LlmExecutionContext,
      ) => {
        calls += 1;
        assert.equal(context, execution);
        return calls === 1 ? "{}" : valid;
      };
      if (stage === "brief") {
        await proposeV2Brief("A quiet film.", "film", chat, execution);
      } else {
        await proposeV2Explanation(packet, chat, execution);
      }
      assert.equal(calls, 2);
    });

    it("does not run repair if the injected chat aborts before returning invalid output", async () => {
      const controller = new AbortController();
      let calls = 0;
      const chat = async () => {
        calls += 1;
        controller.abort();
        return "{}";
      };
      const pending =
        stage === "brief"
          ? proposeV2Brief("A quiet film.", "film", chat, {
              signal: controller.signal,
            })
          : proposeV2Explanation(packet, chat, { signal: controller.signal });
      await assert.rejects(pending, /aborted|cancelled/i);
      assert.equal(calls, 1);
    });
  });
}
