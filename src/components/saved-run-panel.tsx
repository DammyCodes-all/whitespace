"use client";

import { useEffect, useState } from "react";
import { listRuns, loadRun } from "@/lib/demo/store";
import type { PipelineResult } from "@/lib/types";

export function SavedRunPanel() {
  const [ids, setIds] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [run, setRun] = useState<PipelineResult | null>(null);

  useEffect(() => {
    const saved = listRuns();
    setIds(saved);
    if (saved.length > 0) {
      const latest = saved[saved.length - 1];
      setSelectedId(latest);
      setRun(loadRun(latest));
    }
  }, []);

  if (ids.length === 0 || run === null) return null;

  return (
    <section
      aria-label="Saved run replay"
      className="mt-8 border-t border-rule pt-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="text-sm tracking-tight text-ink">Saved run replay</h2>
          <p className="mt-1 font-mono text-xs text-ink-3">
            Loaded locally; no Qloo call was made.
          </p>
        </div>
        <select
          aria-label="Saved runs"
          value={selectedId}
          onChange={(event) => {
            setSelectedId(event.target.value);
            setRun(loadRun(event.target.value));
          }}
          className="border border-rule bg-surface px-3 py-1.5 font-mono text-xs text-ink-2"
        >
          {ids.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
      </div>
      <div className="mt-3 text-sm text-ink-2">
        <p>{run.input.pitchText}</p>
        <p className="mt-1">
          {run.verdict.verdict} ·{" "}
          {run.verdict.topAudienceId ?? "no top audience"} · no Qloo call made
        </p>
        <ul className="mt-3 border-t border-rule font-mono text-xs text-ink-3">
          {run.scores.map((score) => (
            <li
              key={score.audienceId}
              className="flex justify-between border-b border-rule py-1.5"
            >
              <span>{score.audienceId}</span>
              <span>
                {score.noDataTags.length > 0
                  ? "no data"
                  : score.score.toFixed(2)}
              </span>
            </li>
          ))}
        </ul>
        <details className="mt-3 border-t border-rule pt-2">
          <summary className="cursor-pointer">Replay evidence</summary>
          <ul className="mt-2">
            {run.calls.map((call) => (
              <li key={call.id} className="border-b border-rule py-1.5">
                {call.method} {call.endpoint} · {call.status} ·{" "}
                {call.responseSummary ?? "response summary unavailable"}
              </li>
            ))}
          </ul>
        </details>
      </div>
    </section>
  );
}
