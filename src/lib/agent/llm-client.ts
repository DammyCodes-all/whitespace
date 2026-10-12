/**
 * Day 9 U: shared LLM transport. Owned by U.
 *
 * Extracted from `propose.ts` (Day 6.5) so the Day 9 chatbot answer call
 * (§6.11) reuses the same Groq-primary / OpenRouter-fallback mechanics,
 * timeouts and JSON extraction instead of duplicating them. No Qloo, no
 * scoring here — one OpenAI-compatible chat-completions helper.
 */

export const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
export const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export class LlmError extends Error {
  readonly provider: string;
  readonly configured: boolean;

  constructor(message: string, provider: string, configured = true) {
    super(message);
    this.name = "LlmError";
    this.provider = provider;
    this.configured = configured;
  }
}

export interface ChatMessage {
  role: "system" | "user";
  content: string;
}

export function readEnv(name: string): string | null {
  const value = process.env[name];
  return value === undefined || value.trim() === "" ? null : value.trim();
}

/** Strip markdown fences the model sometimes adds despite JSON-only. */
export function extractJson(content: string): string {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = (fenced?.[1] ?? content).trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return raw;
  return raw.slice(start, end + 1);
}

/** Request-scoped cancellation and actual provider-attempt accounting. */
export interface LlmExecutionContext {
  signal?: AbortSignal;
  /** Called immediately before each provider fetch; may refuse dispatch by throwing. */
  onAttempt?: () => void;
}

export interface ChatCompletionOptions extends LlmExecutionContext {
  temperature?: number;
  maxTokens?: number;
  extraHeaders?: Record<string, string>;
}

export async function callChatCompletions(
  url: string,
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  provider: string,
  options: ChatCompletionOptions = {},
): Promise<string> {
  if (options.signal?.aborted) {
    throw new LlmError(`${provider} aborted.`, provider, true);
  }
  const controller = new AbortController();
  const parentAbort = () => controller.abort(options.signal?.reason);
  options.signal?.addEventListener("abort", parentAbort, { once: true });
  let rejectAbort: (reason: LlmError) => void = () => {};
  const aborted = new Promise<never>((_resolve, reject) => {
    rejectAbort = reject;
  });
  // A refusing attempt hook can abort before either race is attached.
  void aborted.catch(() => {});
  const rejectOnAbort = () =>
    rejectAbort(
      new LlmError(
        options.signal?.aborted
          ? `${provider} aborted.`
          : `${provider} timed out.`,
        provider,
        true,
      ),
    );
  controller.signal.addEventListener("abort", rejectOnAbort, { once: true });
  const timer = setTimeout(() => controller.abort(), 20000);
  let res: Response | undefined;
  try {
    controller.signal.throwIfAborted();
    options.onAttempt?.();
    controller.signal.throwIfAborted();
    res = await Promise.race([
      fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          ...options.extraHeaders,
        },
        body: JSON.stringify({
          model,
          messages,
          response_format: { type: "json_object" },
          temperature: options.temperature ?? 0.2,
          max_tokens: options.maxTokens ?? 1200,
        }),
        signal: controller.signal,
      }),
      aborted,
    ]);
    controller.signal.throwIfAborted();
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      const snippet = body.trim().slice(0, 200);
      throw new LlmError(
        snippet.length > 0
          ? `${provider} failed with status ${res.status}: ${snippet}`
          : `${provider} failed with status ${res.status}.`,
        provider,
        true,
      );
    }
    // Fetch headers completing does not end the deadline: a body may still stall.
    const data: unknown = await Promise.race([
      res.json().catch(() => null),
      aborted,
    ]);
    controller.signal.throwIfAborted();
    const content = (
      data as { choices?: { message?: { content?: unknown } }[] }
    )?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || content.trim() === "") {
      throw new LlmError(`${provider} returned no content.`, provider, true);
    }
    return content;
  } catch (err) {
    if (err instanceof LlmError) throw err;
    if (options.signal?.aborted) {
      throw new LlmError(`${provider} aborted.`, provider, true);
    }
    if (
      controller.signal.aborted ||
      (err instanceof Error && err.name === "AbortError")
    ) {
      throw new LlmError(`${provider} timed out.`, provider, true);
    }
    const cause =
      err instanceof Error && err.message !== "" ? `: ${err.message}` : "";
    throw new LlmError(`${provider} request failed${cause}.`, provider, true);
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", parentAbort);
    controller.signal.removeEventListener("abort", rejectOnAbort);
    // Release unconsumed error bodies; active fetch bodies share the abort signal.
    if (res?.body !== null && res?.body !== undefined && !res.bodyUsed) {
      void res.body.cancel().catch(() => {});
    }
  }
}
