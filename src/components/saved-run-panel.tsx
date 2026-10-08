"use client";

import { useEffect, useState } from "react";
import { listRuns, loadRun } from "@/lib/demo/store";
import { isUnjudgeable } from "@/lib/scoring/fit";
import type { FitScore, PipelineResult } from "@/lib/types";

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

function audienceName(run: PipelineResult, id: string): string {
  const all = [run.hypothesis, ...run.rivals, ...run.controls];
  return all.find((a) => a.id === id)?.name ?? id;
}

/** §10 #4: same rule as the ranked list — never a bare 0 placeholder. */
function scoreText(score: FitScore): string {
  return isUnjudgeable(score) ? "not measured" : score.score.toFixed(2);
}

export function SavedRunPanel() {
  const [runs, setRuns] = useState<{ id: string; run: PipelineResult }[]>([]);
  const [selectedId, setSelectedId] = useState("");

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

  const run = runs.find((r) => r.id === selectedId)?.run ?? null;
  if (runs.length === 0 || run === null) return null;

  const labels = new Map<string, number>();
  for (const r of runs) {
    const label = `${oneLiner(r.run.input.pitchText)} — ${r.run.verdict.verdict}`;
    labels.set(label, (labels.get(label) ?? 0) + 1);
  }
  const optionLabel = (id: string, label: string) =>
    (labels.get(label) ?? 0) > 1 ? `${label} · ${id.slice(-4)}` : label;

  const topName =
    run.verdict.topAudienceId === null
      ? "no top audience"
      : audienceName(run, run.verdict.topAudienceId);
  const ranked = [...run.scores].sort((a, b) => b.score - a.score);
  const topThree = ranked.slice(0, 3);
  const rest = ranked.slice(3);
  // Twenty identical zeros carry no information — the verdict line
  // already said it. Only list scores when they differ.
  const scoresDiffer = new Set(ranked.map(scoreText)).size > 1;

  return (
    <section
      aria-label="Saved run replay"
      className="mt-8 border-t border-rule pt-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="text-sm tracking-tight text-ink">
            Saved runs · {runs.length}
          </h2>
          <p className="mt-1 font-mono text-xs text-ink-3">
            Replayed locally — no Qloo calls.
          </p>
        </div>
        <select
          aria-label="Saved runs"
          value={selectedId}
          onChange={(event) => setSelectedId(event.target.value)}
          className="max-w-md border border-rule bg-surface px-3 py-1.5 text-xs text-ink-2"
        >
          {runs.map((r) => {
            const label = `${oneLiner(r.run.input.pitchText)} — ${r.run.verdict.verdict}`;
            return (
              <option key={r.id} value={r.id}>
                {optionLabel(r.id, label)}
              </option>
            );
          })}
        </select>
      </div>
      <div className="mt-3">
        <p className="max-w-prose font-serif text-base text-ink">
          {oneLiner(run.input.pitchText, 160)}
        </p>
        <p data-numeric className="tnum mt-1 font-mono text-xs text-ink-3">
          {run.verdict.verdict} · {topName}
        </p>
        {scoresDiffer ? (
          <>
            <ul className="mt-2 space-y-1 font-mono text-xs">
              {topThree.map((score) => (
                <li
                  key={score.audienceId}
                  className="flex justify-between gap-4"
                >
                  <span className="truncate text-ink-2">
                    {audienceName(run, score.audienceId)}
                  </span>
                  <span data-numeric className="tnum shrink-0 text-ink-3">
                    {scoreText(score)}
                  </span>
                </li>
              ))}
            </ul>
            {rest.length > 0 ? (
              <details className="group/aud mt-1.5">
                <summary className="cursor-pointer list-none font-mono text-xs text-ink-3 underline decoration-dotted underline-offset-4 hover:text-ink">
                  <span className="group-open/aud:hidden">
                    all {ranked.length} audiences
                  </span>
                  <span className="hidden group-open/aud:inline">hide</span>
                </summary>
                <div className="grid grid-rows-[0fr] group-open/aud:grid-rows-[1fr] starting:grid-rows-[0fr] motion-safe:transition-[grid-template-rows] motion-safe:duration-200 motion-safe:ease-out">
                  <div className="overflow-hidden">
                    <ul className="mt-1.5 max-h-64 space-y-1 overflow-y-auto font-mono text-xs">
                      {rest.map((score) => (
                        <li
                          key={score.audienceId}
                          className="flex justify-between gap-4"
                        >
                          <span className="truncate text-ink-2">
                            {audienceName(run, score.audienceId)}
                          </span>
                          <span
                            data-numeric
                            className="tnum shrink-0 text-ink-3"
                          >
                            {scoreText(score)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </details>
            ) : null}
          </>
        ) : null}
        {run.calls.length > 0 ? (
          <details className="group/trace mt-3">
            <summary className="cursor-pointer list-none text-sm text-ink-3 underline decoration-dotted underline-offset-4 hover:text-ink">
              <span className="group-open/trace:hidden">
                Replay trace · {run.calls.length} calls
              </span>
              <span className="hidden group-open/trace:inline">Hide trace</span>
            </summary>
            <div className="grid grid-rows-[0fr] group-open/trace:grid-rows-[1fr] starting:grid-rows-[0fr] motion-safe:transition-[grid-template-rows] motion-safe:duration-200 motion-safe:ease-out">
              <div className="overflow-hidden">
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
              </div>
            </div>
          </details>
        ) : null}
      </div>
    </section>
  );
}
