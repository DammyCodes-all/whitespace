import Link from "next/link";
import { ChangeView } from "@/components/change";
import { EvidenceCalls } from "@/components/evidence";
import { RankedList } from "@/components/ranked-list";
import type { ReachAudience } from "@/components/reach";
import { ReachPlan } from "@/components/reach";
import { RunSaver } from "@/components/run-saver";
import { RunStream } from "@/components/run-stream";
import { VerdictHeadline } from "@/components/verdict";
import {
  mockAudiences,
  mockCalls,
  mockChangedAccepted,
  mockChangedWithheld,
  mockGaps,
  mockInput,
  mockRelated,
  mockScores,
  mockSteps,
  mockUnlabeledCount,
  mockVerdict,
} from "@/lib/demo/mock-run";
import { parseRunInput } from "@/lib/demo/parse-run-input";
import { proposeDeterministic } from "@/lib/demo/propose-stub";
import { selectReachTargets } from "@/lib/demo/reach-targets";
import { TAG_LABELS } from "@/lib/fixtures/tag-labels";
import type { ChangedRun } from "@/lib/pipeline/change";
import { proposeChange } from "@/lib/pipeline/change";
import { runPipeline } from "@/lib/pipeline/run";
import { fetchRelated } from "@/lib/qloo/related";
import { fetchAllAudienceTastes } from "@/lib/qloo/tastes";
import { countUnlabeled, findGaps } from "@/lib/scoring/gaps";
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
  searchParams?: Promise<{
    input?: string | string[];
    constraint?: string | string[];
    preview?: string | string[];
  }>;
}) {
  const params = (await searchParams) ?? {};
  const pipelineInput = parseRunInput(params.input);
  const rawConstraint = Array.isArray(params.constraint)
    ? params.constraint[0]
    : params.constraint;
  const constraint = (rawConstraint ?? "").trim().slice(0, 140);
  const inputParam =
    typeof params.input === "string"
      ? `&input=${encodeURIComponent(params.input)}`
      : "";
  let result: PipelineResult;
  let live = true;
  try {
    result = await runPipeline(pipelineInput);
  } catch {
    result = mockResult();
    live = false;
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

  // Day 7 U: reach plan for the verdict's targets. Tastes are refetched
  // for the top audience only until the pipeline exposes them; related
  // calls join the evidence list so every citation resolves (§10 #8).
  const targets = live
    ? selectReachTargets(result.verdict, result.scores, audiences)
    : [];
  const reachGroups: ReachAudience[] = [];
  const reachCalls: QlooCall[] = [];
  if (live && targets.length > 0) {
    const excludeIds = result.hypothesis.titles.map((t) => t.qlooId);
    const { all: tasteLists } = await fetchAllAudienceTastes(
      targets,
      result.input.workType,
    );
    // Targets are independent: fetch concurrently, then assemble in
    // order so the evidence list stays deterministic (§10 #7).
    const relatedLists = await Promise.all(
      targets.map((audience) => fetchRelated(audience, excludeIds)),
    );
    targets.forEach((audience, index) => {
      const related = relatedLists[index] ?? [];
      const tastes = tasteLists.find((t) => t.audienceId === audience.id);
      const gaps = tastes ? findGaps(tastes, result.tags, TAG_LABELS) : [];
      const unlabeledCount = tastes
        ? countUnlabeled(tastes, result.tags, TAG_LABELS)
        : 0;
      for (const group of related) {
        if (group.call !== null) reachCalls.push(group.call);
      }
      reachGroups.push({
        audience,
        headline: index === 0 ? "Best fit" : "Runner-up · Split verdict",
        related,
        gaps,
        unlabeledCount,
        tastesCallId: stepCallId("tastes"),
      });
    });
  } else if (!live && top) {
    reachGroups.push({
      audience: top,
      headline: "Best fit",
      related: mockRelated,
      gaps: mockGaps,
      unlabeledCount: mockUnlabeledCount,
      tastesCallId: "call-insights-1",
    });
  }

  // Day 8 U: constrained recheck. The constraint arrives as a query
  // param so the URL stays shareable; the deterministic stub proposes
  // until the LLM rewrite lands (same ProposeFn seam, no caller change).
  // Rescore calls join the evidence list so every citation resolves.
  // `?preview=` renders a mock outcome for rehearsing states that are
  // hard to reach interactively (e.g. accepted on the mock path).
  const rawPreview = Array.isArray(params.preview)
    ? params.preview[0]
    : params.preview;
  const previewChanged =
    rawPreview === "accepted"
      ? mockChangedAccepted
      : rawPreview !== undefined
        ? (mockChangedWithheld[rawPreview] ?? null)
        : null;
  let changed: ChangedRun | null = previewChanged;
  let changeFailed = false;
  const changeCalls: QlooCall[] = [...(changed?.calls ?? [])];
  if (constraint !== "" && changed === null) {
    try {
      changed = await proposeChange(result, constraint, proposeDeterministic);
      changeCalls.push(...changed.calls);
    } catch {
      changed = null;
      changeFailed = true;
    }
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

        <section aria-label="Try a limit" className="mt-12">
          <h2 className="text-lg tracking-tight text-ink">Try a limit</h2>
          <form action="/run" method="get" className="mt-4">
            {typeof params.input === "string" && (
              <input type="hidden" name="input" value={params.input} />
            )}
            <label
              htmlFor="constraint"
              className="block text-sm tracking-tight text-ink"
            >
              Add a limit, such as a smaller budget or a shorter format
            </label>
            <p className="mt-1 text-sm text-ink-3">
              The pitch is rewritten under your limit and rechecked against the
              same bar.
            </p>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row">
              <input
                id="constraint"
                name="constraint"
                type="text"
                defaultValue={constraint}
                maxLength={140}
                placeholder="Lower budget"
                className="min-w-0 flex-1 border border-rule bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-ink-3"
              />
              <button
                type="submit"
                className="shrink-0 bg-measured px-5 py-2.5 text-sm text-white transition-transform duration-150 ease-out active:scale-[0.97]"
              >
                Check change
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {["Lower budget", "Shorter format", "Smaller cast"].map(
                (preset) => (
                  <Link
                    key={preset}
                    href={`/run?constraint=${encodeURIComponent(preset)}${inputParam}`}
                    className="border border-rule px-3 py-1.5 font-mono text-xs text-ink-2 transition-colors hover:text-ink"
                  >
                    {preset}
                  </Link>
                ),
              )}
            </div>
          </form>
          {changed !== null && (
            <div className="mt-4 border-t border-rule">
              <ChangeView changed={changed} />
            </div>
          )}
          {changeFailed && (
            <p className="mt-4 text-sm text-ink-3">
              The recheck failed. The run above is unaffected.
            </p>
          )}
        </section>

        <EvidenceCalls
          calls={[...result.calls, ...reachCalls, ...changeCalls]}
        />

        <div className="mt-12 flex flex-wrap items-center gap-4">
          <Link
            href="/"
            className="inline-block bg-measured px-5 py-2.5 text-sm text-white transition-transform duration-150 ease-out active:scale-[0.97]"
          >
            Back to start
          </Link>
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
