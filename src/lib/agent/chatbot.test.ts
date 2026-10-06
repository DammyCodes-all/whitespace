import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { answerChatbot, toChatbotResult } from "./chatbot.ts";
import { LlmError } from "./llm-client.ts";

// No keys in this env: validation and keyless paths never dial the network.
delete process.env.GROQ_API_KEY;
delete process.env.OPENROUTER_API_KEY;

describe("toChatbotResult", () => {
  it("accepts a valid answer plus titles", () => {
    const result = toChatbotResult({
      answer: "Fans of slow sci-fi will find this. Try arthouse cinemas.",
      titles: ["Moon", "Arrival"],
    });
    assert.equal(result.titles.length, 2);
    assert.ok(result.answer.startsWith("Fans of slow"));
  });

  it("rejects non-object JSON", () => {
    assert.throws(() => toChatbotResult("nope"), LlmError);
    assert.throws(() => toChatbotResult(null), LlmError);
  });

  it("rejects an empty answer", () => {
    assert.throws(
      () => toChatbotResult({ answer: "  ", titles: ["Moon"] }),
      LlmError,
    );
  });

  it("rejects a title-less answer (nothing to mark)", () => {
    assert.throws(
      () => toChatbotResult({ answer: "Some advice.", titles: [] }),
      LlmError,
    );
  });

  it("dedupes and caps titles", () => {
    const titles = Array.from({ length: 15 }, (_, i) => `Title ${i}`);
    const result = toChatbotResult({
      answer: "Advice.",
      titles: ["Moon", " moon ", ...titles],
    });
    assert.equal(result.titles.length, 10);
    assert.deepEqual(
      result.titles.filter((t) => t.toLowerCase() === "moon"),
      ["Moon"],
    );
  });
});

describe("answerChatbot", () => {
  it("throws configured=false with no keys (UI shows unavailable)", async () => {
    await assert.rejects(
      answerChatbot({ pitchText: "A quiet film.", workType: "film" }),
      (err: unknown) => err instanceof LlmError && err.configured === false,
    );
  });

  it("rejects empty pitch text before any network", async () => {
    await assert.rejects(
      answerChatbot({ pitchText: "   ", workType: "film" }),
      LlmError,
    );
  });
});
