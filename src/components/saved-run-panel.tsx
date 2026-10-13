"use client";

import { useEffect, useState } from "react";
import { listRuns, loadRun } from "@/lib/demo/store";
import { isUnjudgeable } from "@/lib/scoring/fit";
import type {
  Audience,
  FitScore,
  PipelineResult,
  Verdict,
  WorkType,
} from "@/lib/types";

function truncateWords(value: string, max: number): string {
  const text = value.trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max).trimEnd();
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

function oneLiner(pitchText: string, max = 64): string {
  const first = pitchText.split(/[.\n]/)[0]?.trim() ?? "";
  const line = first === "" ? pitchText.trim() : first;
  return truncateWords(line, max);
}

function audienceById(
  run: PipelineResult,
  id: string | null,
): Audience | undefined {
  if (id === null) return undefined;
  const all = [run.hypothesis, ...run.rivals, ...run.controls];
  return all.find((a) => a.id === id);
}

function audienceName(run: PipelineResult, id: string): string {
  return audienceById(run, id)?.name ?? id;
}

/** "Hypothesis (film)" — kind of the top audience plus the run's domain. */
function kindLabel(run: PipelineResult, id: string | null): string {
  const audience = audienceById(run, id);
  if (audience === undefined) return "no top audience";
  const kind =
    audience.kind === "hypothesis"
      ? "Hypothesis"
      : audience.kind === "rival"
        ? "Rival"
        : audience.kind === "control"
          ? "Control"
          : "Exclusion";
  const workType: WorkType = run.input.workType;
  return `${kind} (${workType})`;
}

/** Verdict word color by meaning. Inconclusive abstains: quiet, no emphasis. */
function verdictClass(verdict: Verdict): string {
  switch (verdict) {
    case "Strong":
      return "font-medium text-ink";
    case "Mixed":
      return "font-medium text-split";
    case "Weak":
      return "font-medium text-weak";
    case "Inconclusive":
      return "text-ink-3";
  }
}

/** §10 #4: same rule as the ranked list — never a bare 0 placeholder. */
function scoreText(score: FitScore): string {
  return isUnjudgeable(score) ? "not measured" : score.score.toFixed(2);
}

export function SavedRunPanel() {
  const [runs, setRuns] = useState<{ id: string; run: PipelineResult }[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [showTrace, setShowTrace] = useState(false);
  const [showRuns, setShowRuns] = useState(false);

  useEffect(() => {
    const loaded = listRuns()
      .reverse()
      .flatMap((id) => {
        const run = loadRun(id);
        return run === null ? [] : [{ id, run }];
      });
    setRuns(loaded);
    if (loaded.length > 0) setSelectedId(loaded[0].id);
  }, []);

  function select(id: string) {
    setSelectedId(id);
    setShowAll(false);
    setShowTrace(false);
    setShowRuns(false);
  }

  const run = runs.find((r) => r.id === selectedId)?.run ?? null;
  if (runs.length === 0 || run === null) return null;

  const ranked = [...run.scores].sort((a, b) => b.score - a.score);
  const topThree = ranked.slice(0, 3);
  const rest = ranked.slice(3);
  // Twenty identical zeros carry no information — the verdict line
  // already said it. Only list scores when they differ.
  const scoresDiffer = new Set(ranked.map(scoreText)).size > 1;
  const topScore = Math.max(
    ...ranked.filter((s) => !isUnjudgeable(s)).map((s) => s.score),
    0,
  );
  const listed = showRuns ? runs : runs.filter((r) => r.id === selectedId);

  return (
    <section
      aria-label="Saved run replay"
      className="mt-8 border-t border-rule pt-4"
    >
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-sans text-[15px] text-ink">
          Saved runs · {runs.length}
        </h2>
        <p className="font-mono text-xs text-ink-3">
          Replayed locally — no Qloo calls.
        </p>
      </div>

      <div className="mt-9 grid gap-10 md:grid-cols-[340px_1fr] md:gap-14">
        <div>
          {listed.map((r, li) => {
            const index = runs.findIndex((v) => v.id === r.id);
            const selected = r.id === selectedId;
            const label = `${r.run.verdict.verdict} · ${kindLabel(r.run, r.run.verdict.topAudienceId)}`;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => select(r.id)}
                aria-current={selected}
                aria-label={`Saved run ${index + 1}: ${label}`}
                className={`w-full border-rule py-[18px] pb-5 text-left ${
                  li === listed.length - 1 ? "border-b" : ""
                } ${
                  selected
                    ? "border-t-[1.5px] border-ink text-ink"
                    : "border-t text-ink-2"
                }`}
              >
                <div
                  data-numeric
                  className="tnum font-mono text-[11.5px] text-ink-3"
                >
                  {String(index + 1).padStart(2, "0")}
                </div>
                <div className="mt-1 line-clamp-2 font-serif text-[22px] leading-[1.22]">
                  {oneLiner(r.run.input.pitchText)}
                </div>
                <div className="mt-1 font-mono text-xs text-ink-3">
                  <span className={verdictClass(r.run.verdict.verdict)}>
                    {r.run.verdict.verdict}
                  </span>{" "}
                  · {kindLabel(r.run, r.run.verdict.topAudienceId)}
                </div>
              </button>
            );
          })}
          {runs.length > 2 ? (
            <button
              type="button"
              aria-expanded={showRuns}
              onClick={() => setShowRuns((v) => !v)}
              className="py-3 font-mono text-[13px] text-ink-2 underline decoration-dotted decoration-ink-3 underline-offset-[5px] hover:text-ink"
            >
              {showRuns ? "fewer runs" : `all ${runs.length} runs`}
            </button>
          ) : null}
        </div>

        <div className="md:border-l md:border-rule md:pl-14">
          <p className="font-mono text-xs text-ink-3">
            <span className={verdictClass(run.verdict.verdict)}>
              {run.verdict.verdict}
            </span>{" "}
            · {kindLabel(run, run.verdict.topAudienceId)}
          </p>
          <h3 className="mt-2 max-w-[640px] font-serif text-[28px] font-normal leading-[1.14] text-ink md:text-[40px]">
            {oneLiner(run.input.pitchText, 160)}
          </h3>

          {scoresDiffer ? (
            <div className="mt-6">
              <div className="flex items-baseline justify-between border-b border-rule pb-2 font-mono text-xs text-ink-3">
                <span>Top audiences</span>
                <span data-numeric className="tnum">
                  3 of {ranked.length}
                </span>
              </div>
              <ul>
                {topThree.map((score) => {
                  const judged = !isUnjudgeable(score);
                  const width =
                    judged && topScore > 0
                      ? `${(score.score / topScore) * 100}%`
                      : "0%";
                  return (
                    <li
                      key={score.audienceId}
                      className="grid grid-cols-[1fr_48px] items-center gap-x-6 gap-y-2 py-[13px] md:grid-cols-[190px_1fr_48px]"
                    >
                      <span className="min-w-0 truncate font-mono text-sm text-ink">
                        {audienceName(run, score.audienceId)}
                      </span>
                      <span
                        data-numeric
                        className="tnum text-right font-mono text-sm text-measured md:order-3"
                      >
                        {scoreText(score)}
                      </span>
                      <div className="col-span-2 h-1 bg-measured-soft md:order-2 md:col-span-1">
                        {judged ? (
                          <div
                            className="h-full bg-measured"
                            style={{ width }}
                          />
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

          <div className="mt-2 flex gap-8">
            {scoresDiffer && rest.length > 0 ? (
              <button
                type="button"
                aria-expanded={showAll}
                onClick={() => setShowAll((v) => !v)}
                className="py-3 font-mono text-[13px] text-ink-2 underline decoration-dotted decoration-ink-3 underline-offset-[5px] hover:text-ink"
              >
                {showAll ? "fewer audiences" : `all ${ranked.length} audiences`}
              </button>
            ) : null}
            {run.calls.length > 0 ? (
              <button
                type="button"
                aria-expanded={showTrace}
                onClick={() => setShowTrace((v) => !v)}
                className="py-3 font-sans text-sm text-ink-2 underline decoration-dotted decoration-ink-3 underline-offset-[5px] hover:text-ink"
              >
                {showTrace
                  ? "Hide trace"
                  : `Replay trace · ${run.calls.length} calls`}
              </button>
            ) : null}
          </div>

          {showAll && scoresDiffer && rest.length > 0 ? (
            <ul className="max-h-64 overflow-y-auto">
              {rest.map((score) => {
                const judged = !isUnjudgeable(score);
                const width =
                  judged && topScore > 0
                    ? `${(score.score / topScore) * 100}%`
                    : "0%";
                return (
                  <li
                    key={score.audienceId}
                    className="grid grid-cols-[1fr_48px] items-center gap-x-6 gap-y-2 py-[13px] md:grid-cols-[190px_1fr_48px]"
                  >
                    <span className="min-w-0 truncate font-mono text-sm text-ink">
                      {audienceName(run, score.audienceId)}
                    </span>
                    <span
                      data-numeric
                      className="tnum text-right font-mono text-sm text-measured md:order-3"
                    >
                      {scoreText(score)}
                    </span>
                    <div className="col-span-2 h-1 bg-measured-soft md:order-2 md:col-span-1">
                      {judged ? (
                        <div className="h-full bg-measured" style={{ width }} />
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : null}

          {showTrace && run.calls.length > 0 ? (
            <ul className="mt-2 max-h-80 space-y-1.5 overflow-y-auto font-mono text-xs text-ink-3">
              {run.calls.map((call) => (
                <li key={call.id} data-numeric className="tnum break-all">
                  {call.method} {call.endpoint} · {call.status} ·{" "}
                  {truncateWords(
                    call.responseSummary ?? "response unavailable",
                    90,
                  )}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </section>
  );
}
