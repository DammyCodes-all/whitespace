"use client";

/**
 * Package C: the flow, orchestrated here, rendered in step modules.
 *
 * Step 1 input → step 2 chips + titles → run → results. State and data
 * flow stay here; markup lives in src/components/flow/* so no file
 * grows bulky. Heading/ID contracts: flow-input-heading,
 * flow-tags-heading, flow-titles-heading, flow-suggest-heading,
 * flow-run-heading, flow-results-heading, flow-idea-heading,
 * flow-change-heading.
 *
 * Spec: §6.1, §6.2, §6.5, §6.7–§6.9, §6.11, §6.12 (copy/behavior unchanged).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { FlowInputStep } from "@/components/flow/flow-input-step";
import { FlowResultsStep } from "@/components/flow/flow-results-step";
import { FlowRunningStep } from "@/components/flow/flow-running-step";
import { FlowTagsStep } from "@/components/flow/flow-tags-step";
import { FlowTitlesStep } from "@/components/flow/flow-titles-step";
import {
  addSuggestedTitle,
  chipFetch,
  fetchTitleSuggestions,
  fetchTitleTags,
  removeSimilarTitle,
  resetTitleDerived,
} from "@/components/flow/flow-tag-actions";
import {
  checkChangeAction,
  extractTagsAction,
  runAnalysisAction,
} from "@/components/flow/flow-run-actions";
import type {
  ChangedRun,
  CheckResult,
  CompareResponseBody,
  FlowPhase,
  FlowResult,
  FlowStepRow,
  QlooCall,
  TitleGift,
  WorkType,
} from "@/components/flow/flow-types";
import type { ChatbotView } from "@/components/chatbot-preview";
import { parseSimilarTitles } from "@/lib/flow/similar-titles";

export function FlowClient({
  initialPitch = "",
  autoStart = false,
}: {
  initialPitch?: string;
  autoStart?: boolean;
}) {
  const [phase, setPhase] = useState<FlowPhase>("input");
  const [pitchText, setPitchText] = useState(initialPitch);
  const [workType, setWorkType] = useState<WorkType>("film");
  const [similarTitles, setSimilarTitles] = useState("");
  const [qlooSuggestions, setQlooSuggestions] = useState<string[]>([]);
  const [suggestBusy, setSuggestBusy] = useState(false);
  const [suggestDone, setSuggestDone] = useState(false);
  const [titleTags, setTitleTags] = useState<TitleGift[]>([]);
  const [titleTagsBusy, setTitleTagsBusy] = useState(false);
  const [titleTagsDone, setTitleTagsDone] = useState(false);
  const [cutGifts, setCutGifts] = useState<TitleGift[]>([]);
  const [showCutGifts, setShowCutGifts] = useState(false);
  const [previewNote, setPreviewNote] = useState<string | null>(null);
  const [tags, setTags] = useState<FlowResult["tags"]>([]);
  const [steps, setSteps] = useState<FlowStepRow[]>([]);
  const [result, setResult] = useState<FlowResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [chatbot, setChatbot] = useState<ChatbotView | null>(null);
  const [chatbotError, setChatbotError] = useState<string | null>(null);
  const [compareCalls, setCompareCalls] = useState<QlooCall[]>([]);
  const [compareLoaded, setCompareLoaded] = useState(false);
  const [constraint, setConstraint] = useState("");
  const [changed, setChanged] = useState<ChangedRun | null>(null);
  const [changeBusy, setChangeBusy] = useState(false);
  const [changeError, setChangeError] = useState<string | null>(null);
  const [checkBusy, setCheckBusy] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [checkResult, setCheckResult] = useState<CheckResult | null>(null);

  const matched = tags.filter((t) => t.status === "matched").length;
  const parsedSimilar = parseSimilarTitles(similarTitles);
  const autoStarted = useRef(false);
  const titleSetters = {
    setCheckResult,
    setTitleTags,
    setCutGifts,
    setShowCutGifts,
    setPreviewNote,
    setTitleTagsDone,
    setSimilarTitles,
  };

  async function checkSimilarTitles() {
    const list = parseSimilarTitles(similarTitles);
    if (list.length === 0 || checkBusy) return;
    setCheckBusy(true);
    setCheckError(null);
    try {
      const res = await chipFetch("/api/titles/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titles: list, workType }),
      });
      const data = (await res.json()) as {
        resolved?: { query: string; name: string; qlooId: string }[];
        notFound?: string[];
        error?: string;
      };
      if (!res.ok) {
        setCheckError(data.error ?? "Could not check the titles.");
        setCheckResult(null);
        return;
      }
      setCheckResult({
        resolved: Array.isArray(data.resolved) ? data.resolved : [],
        notFound: Array.isArray(data.notFound) ? data.notFound : [],
      });
      const resolvedNames = Array.isArray(data.resolved)
        ? data.resolved
            .map((r) => r.name)
            .filter(
              (n): n is string => typeof n === "string" && n.trim() !== "",
            )
        : [];
      setTitleTags([]);
      setCutGifts([]);
      setShowCutGifts(false);
      setPreviewNote(null);
      setTitleTagsDone(false);
      setQlooSuggestions([]);
      setSuggestDone(false);
      if (resolvedNames.length > 0) {
        void fetchTitleTags(resolvedNames, workType, pitchText, {
          setTitleTagsBusy,
          setPreviewNote,
          setTitleTags,
          setCutGifts,
          setShowCutGifts,
          setTitleTagsDone,
        });
        void fetchTitleSuggestions(
          Array.isArray(data.resolved)
            ? data.resolved
                .map((r) => r.qlooId)
                .filter(
                  (id): id is string =>
                    typeof id === "string" && id.trim() !== "",
                )
            : [],
          parseSimilarTitles(similarTitles),
          workType,
          { setQlooSuggestions, setSuggestBusy, setSuggestDone },
        );
      } else {
        setTitleTagsDone(true);
        setSuggestDone(true);
      }
    } catch {
      setCheckError("Could not reach the title check.");
      setCheckResult(null);
    } finally {
      setCheckBusy(false);
    }
  }

  const run = useCallback(() => {
    void runAnalysisAction(
      { pitchText, workType, tags, similarTitles, titleTags },
      {
        setBusy,
        setError,
        setSteps,
        setPhase,
        setResult,
        setChatbot,
        setChatbotError,
        setCompareCalls,
        setCompareLoaded,
        setChanged,
        setChangeError,
      },
    );
  }, [pitchText, workType, tags, similarTitles, titleTags]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: mount-only auto-start
  useEffect(() => {
    if (autoStart && initialPitch.trim() !== "" && !autoStarted.current) {
      autoStarted.current = true;
      void extractTagsAction(pitchText, workType, {
        setBusy,
        setError,
        setTags,
        setWorkType,
        setPhase,
      });
    }
  }, []);

  const compareForResult = useRef<FlowResult | null>(null);
  useEffect(() => {
    if (phase !== "done" || result === null) return;
    if (compareForResult.current === result) return;
    compareForResult.current = result;
    const startedFor = result;
    void (async () => {
      try {
        const res = await fetch("/api/compare", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pitchText: startedFor.pitch,
            workType: startedFor.type,
          }),
        });
        const data = (await res.json()) as CompareResponseBody;
        if (compareForResult.current !== startedFor) return;
        setChatbot(data.chatbot ?? null);
        setChatbotError(data.error ?? null);
        setCompareCalls(Array.isArray(data.calls) ? data.calls : []);
      } catch {
        if (compareForResult.current !== startedFor) return;
        setChatbot(null);
        setChatbotError("Chatbot comparison failed.");
        setCompareCalls([]);
      } finally {
        if (compareForResult.current === startedFor) setCompareLoaded(true);
      }
    })();
  }, [phase, result]);

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-12 sm:px-8">
      {phase === "input" && (
        <FlowInputStep
          pitchText={pitchText}
          similarTitles={similarTitles}
          busy={busy}
          error={error}
          onPitchChange={setPitchText}
          onSimilarChange={setSimilarTitles}
          onExtract={() =>
            void extractTagsAction(pitchText, workType, {
              setBusy,
              setError,
              setTags,
              setWorkType,
              setPhase,
            })
          }
        />
      )}

      {phase === "tags" && (
        <section aria-labelledby="flow-tags-heading">
          <FlowTagsStep
            tags={tags}
            workType={workType}
            titleTags={titleTags}
            cutGifts={cutGifts}
            showCutGifts={showCutGifts}
            titleTagsBusy={titleTagsBusy}
            titleTagsDone={titleTagsDone}
            checkResult={checkResult}
            previewNote={previewNote}
            busy={busy}
            onTagsChange={setTags}
            onRemoveTitleTag={(qlooId) =>
              setTitleTags((prev) => prev.filter((t) => t.qlooId !== qlooId))
            }
            onToggleCutGifts={() => setShowCutGifts((v) => !v)}
            onRestoreGift={(gift) => {
              setTitleTags((prev) =>
                prev.some((t) => t.qlooId === gift.qlooId)
                  ? prev
                  : [...prev, gift],
              );
              setCutGifts((prev) =>
                prev.filter((t) => t.qlooId !== gift.qlooId),
              );
            }}
          />
          <FlowTitlesStep
            similarTitles={similarTitles}
            parsedSimilar={parsedSimilar}
            matched={matched}
            titleTagCount={titleTags.length}
            checkBusy={checkBusy}
            checkError={checkError}
            checkResult={checkResult}
            titleTagsDone={titleTagsDone}
            suggestDone={suggestDone}
            suggestBusy={suggestBusy}
            suggestions={qlooSuggestions}
            busy={busy}
            error={error}
            onSimilarChange={(v) => {
              setSimilarTitles(v);
              resetTitleDerived(titleSetters);
            }}
            onCheck={() => void checkSimilarTitles()}
            onRemoveSimilar={(title) =>
              removeSimilarTitle(title, similarTitles, titleSetters)
            }
            onAddSuggested={(title) =>
              addSuggestedTitle(title, similarTitles, titleSetters)
            }
            onRun={run}
            onEditPitch={() => setPhase("input")}
          />
        </section>
      )}

      {phase === "running" && <FlowRunningStep steps={steps} />}

      {phase === "done" && result !== null && (
        <FlowResultsStep
          result={result}
          similarList={parsedSimilar}
          steps={steps}
          chatbot={chatbot}
          chatbotError={chatbotError}
          compareLoaded={compareLoaded}
          compareCalls={compareCalls}
          changed={changed}
          changeBusy={changeBusy}
          changeError={changeError}
          constraint={constraint}
          onConstraintChange={setConstraint}
          onCheckChange={() =>
            void checkChangeAction(result, constraint, changeBusy, {
              setChangeBusy,
              setChangeError,
              setChanged,
            })
          }
        />
      )}
    </div>
  );
}
