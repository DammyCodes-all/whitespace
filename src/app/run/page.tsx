import Link from "next/link";
import { ChatbotPreview, type ChatbotView } from "@/components/chatbot-preview";
import { EvidenceCalls } from "@/components/evidence";
import { RankedList } from "@/components/ranked-list";
import type { ReachAudience } from "@/components/reach";
import { ReachPlan } from "@/components/reach";
import { RunSaver } from "@/components/run-saver";
import { RunStream } from "@/components/run-stream";
import { VerdictHeadline } from "@/components/verdict";
import { answerChatbot } from "@/lib/agent/chatbot";
import { LlmError } from "@/lib/agent/llm-client";
import {
  mockAudiences,
  mockCalls,
  mockGaps,
  mockInput,
  mockRelated,
  mockScores,
  mockSteps,
  mockUnlabeledCount,
  mockVerdict,
} from "@/lib/demo/mock-run";
import { parseRunInput } from "@/lib/demo/parse-run-input";
import { buildReachGroups } from "@/lib/demo/reach-groups";
import { runPipeline } from "@/lib/pipeline/run";
import { markChatbotTitles } from "@/lib/qloo/mark";
import type { PipelineResult, QlooCall } from "@/lib/types";

/**
 * Day 6 U: run page on the live seam with saved-run fallback. Owned by U.
 * Day 6.5 U: accepts `?input=` (encoded `PipelineInput` from the pitch
 * form's propose plus confirm step); absent or invalid input falls back
 * to `demoPipelineInput` (§6.1).
 *
 * Server Component: awaits `runPipeline()` (server-only) and renders the
 * result through the Day 3 to Day 5 views. The pipeline never throws on
 * Qloo failure, so the catch below only fires on programming errors —
 * then the Day 1 mocks render with an honest "on mocks" label (§9).
 * A save-only island stores live runs for replay (§6.12, §10 #6);
 * loading them back is later demo work. Dynamic: `searchParams` make
 * this request-time; without `?input=` it runs the demo pitch (mock path
 * when keyless, cheap).
 *
 * Spec ref: §5.4 (watch the agent work), §6.1 (form to run), §6.7
 * (verdict), §6.12 (evidence trace), §9 (saved runs as fallback).
 */

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Run: Whitespace",
  description:
    "A live audience run through the pipeline, with saved runs and mocks as fallback.",
};

/** Mock ceiling from the Day 1 fixture scores; live runs derive it. */
const MOCK_CONTROL_CEILING = 0.44;

/** Day 1 mocks as a full PipelineResult for the fallback render. */
function mockResult(): PipelineResult {
  const hypothesis =
    mockAudiences.find((a) => a.kind === "hypothesis") ?? mockAudiences[0];
  return {
    input: mockInput,
    hypothesis,
    rivals: mockAudiences.filter((a) => a.kind === "rival"),
    controls: [],
    tags: [],
    coverage: 2 / 3,
    scores: mockScores,
    verdict: mockVerdict,
    grounding: { ok: true, ungroundedTitles: [], ungroundedTags: [] },
    calls: mockCalls,
    steps: mockSteps,
  };
}

/** Day 1 mock citation per audience; live runs derive these from steps. */
const MOCK_AUDIENCE_CALL_IDS: Record<string, string> = {
  hyp: "call-search-1",
  "rival-lit": "call-insights-1",
  "rival-amb": "call-search-2",
};

export default async function RunPage({
  searchParams,
}: {
  searchParams?: Promise<{ input?: string | string[] }>;
}) {
  const params = (await searchParams) ?? {};
  const pipelineInput = parseRunInput(params.input);
  // Day 9 U: the chatbot answers in parallel with the pipeline — it needs
  // no Qloo, so serializing it would only spend the 90s budget (§10 #6).
  // Either side may fail independently; the run never depends on the bot.
  const [pipeRes, chatRes] = await Promise.allSettled([
    runPipeline(pipelineInput),
    answerChatbot({
      pitchText: pipelineInput.pitchText,
      workType: pipelineInput.workType,
    }),
  ]);
  let result: PipelineResult;
  let live = true;
  if (pipeRes.status === "fulfilled") {
    result = pipeRes.value;
  } else {
    result = mockResult();
    live = false;
  }

  // §6.11 marks: every chatbot title checked in Qloo. Keyless the bot
  // throws `configured=false` at once, so this costs nothing keyless;
  // live it adds one LLM call plus one `/search` per unique title (§11).
  let chatbot: ChatbotView | null = null;
  let chatbotCalls: QlooCall[] = [];
  let chatbotError: string | null = null;
  if (live && chatRes.status === "fulfilled") {
    try {
      const marks = await markChatbotTitles(
        chatRes.value.titles,
        pipelineInput.workType,
      );
      chatbot = {
        answer: chatRes.value.answer,
        found: marks.found,
        notFoundTitles: marks.notFoundTitles,
      };
      chatbotCalls = marks.calls;
    } catch {
      chatbotError = "Chatbot titles could not be checked in Qloo.";
    }
  } else if (chatRes.status === "rejected") {
    const reason = chatRes.reason;
    chatbotError =
      reason instanceof LlmError && reason.configured === false
        ? "Chatbot comparison needs an LLM key."
        : "Chatbot comparison failed.";
  }

  const audiences = [result.hypothesis, ...result.rivals];
  const top = audiences.find((a) => a.id === result.verdict.topAudienceId);

  const controlIds = new Set(result.controls.map((c) => c.id));
  const controlBest = result.scores
    .filter((s) => controlIds.has(s.audienceId))
    .reduce((best, s) => Math.max(best, s.score), 0);
  const controlCeiling = controlBest > 0 ? controlBest : MOCK_CONTROL_CEILING;

  // Step-based evidence map (§6.12): each audience links the pipeline
  // step that produced it. Keys stay absent when a phase made no calls,
  // and the list falls back to its placeholder citation.
  const stepCallId = (id: string) =>
    result.steps.find((s) => s.id === id)?.callId;
  const audienceCallIds: Record<string, string> = live
    ? {}
    : { ...MOCK_AUDIENCE_CALL_IDS };
  if (live) {
    const hypCall = stepCallId("hypothesis");
    if (hypCall !== undefined) audienceCallIds[result.hypothesis.id] = hypCall;
    const rivalCall = stepCallId("rivals");
    if (rivalCall !== undefined) {
      for (const rival of result.rivals) audienceCallIds[rival.id] = rivalCall;
    }
    const controlCall = stepCallId("controls") ?? stepCallId("tastes");
    if (controlCall !== undefined) {
      for (const control of result.controls)
        audienceCallIds[control.id] = controlCall;
    }
  }

  const context = live ? "live" : "on mocks";

  // Day 7 U + Day 9 U: reach plan for the verdict's targets, assembled
  // in one place so `/run` and `/case` agree. Related calls join the
  // evidence list so every citation resolves (§10 #8).
  let reachGroups: ReachAudience[] = [];
  let reachCalls: QlooCall[] = [];
  if (live) {
    const built = await buildReachGroups(result);
    reachGroups = built.groups;
    reachCalls = built.calls;
  } else if (top) {
    reachGroups.push({
      audience: top,
      headline: "Best fit",
      related: mockRelated,
      gaps: mockGaps,
      unlabeledCount: mockUnlabeledCount,
      tastesCallId: "call-insights-1",
    });
  }

  return (
    <main className="flex flex-1 flex-col">
      <div className="mx-auto w-full max-w-3xl flex-1 px-6 py-12 sm:px-8">
        <p className="font-mono text-xs tracking-tight text-ink-3">
          {live ? "Live run" : "Sample run on mocks"}
        </p>
        <VerdictHeadline
          verdict={result.verdict}
          pitchText={result.input.pitchText}
          context={context}
        />

        <div className="mt-8">
          <RunStream steps={result.steps} />
        </div>

        <RankedList
          audiences={audiences}
          scores={result.scores}
          controlCeiling={controlCeiling}
          audienceCallIds={audienceCallIds}
          topName={top ? `${top.name}${live ? "" : " (on mocks)"}` : undefined}
        />

        <ReachPlan groups={reachGroups} />

        <ChatbotPreview chatbot={chatbot} error={chatbotError} />

        <EvidenceCalls
          calls={[...result.calls, ...reachCalls, ...chatbotCalls]}
        />

        <div className="mt-12 flex flex-wrap items-center gap-4">
          <Link
            href="/"
            className="inline-block bg-measured px-5 py-2.5 text-sm text-white transition-transform duration-150 ease-out active:scale-[0.97]"
          >
            Back to start
          </Link>
          {live ? (
            <Link
              href={`/case?input=${encodeURIComponent(JSON.stringify(pipelineInput))}`}
              className="inline-block border border-rule px-5 py-2.5 text-sm text-ink transition-colors hover:border-ink"
            >
              Audience case
            </Link>
          ) : null}
          {live ? (
            <RunSaver result={result} id="latest" />
          ) : (
            <p className="font-mono text-xs text-ink-3">
              Live run failed, showing mocks.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
