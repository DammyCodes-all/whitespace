"use client";

/**
 * Package C: the flow, one client component. Owned by U.
 *
 * Step 1 input → step 2 chips (live match status + stop gate) →
 * step 4 run with streamed steps → results from the adapter only.
 *
 * Fixtures are used ONLY for the two states that are hard to reach
 * interactively (inconclusive, nothing-beats-ceiling). Every displayed
 * value carries an evidence id, and no number is ever shown for
 * something that was not measured — that is enforced upstream by the
 * adapter, not here.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { FlowResultView } from "@/components/flow-result-view";
import { TagChips } from "@/components/tag-chips";
import { MIN_MATCHED_TAGS } from "@/lib/config";
import type { FlowResult } from "@/lib/flow/contract";
import type { FlowStepRow } from "@/lib/flow/view-types";
import type { WorkType } from "@/lib/types";

type Phase = "input" | "tags" | "running" | "done";

interface RunResponseBody {
  result: FlowResult;
  steps: FlowStepRow[];
  stopped: boolean;
}

export function FlowClient({
  initialPitch = "",
  autoStart = false,
}: {
  initialPitch?: string;
  autoStart?: boolean;
}) {
  const [phase, setPhase] = useState<Phase>("input");
  const [pitchText, setPitchText] = useState(initialPitch);
  // The pitch's type is read by the tag call, never picked by hand.
  const [workType, setWorkType] = useState<WorkType>("film");
  const [similarTitles, setSimilarTitles] = useState("");
  const [tags, setTags] = useState<FlowResult["tags"]>([]);
  const [steps, setSteps] = useState<FlowStepRow[]>([]);
  const [result, setResult] = useState<FlowResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const matched = tags.filter((t) => t.status === "matched").length;
  const autoStarted = useRef(false);

  async function extractTags() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pitchText }),
      });
      const data = (await res.json()) as {
        tags?: FlowResult["tags"];
        workType?: WorkType;
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Could not read the pitch tags.");
        return;
      }
      setTags(data.tags ?? []);
      if (
        data.workType === "film" ||
        data.workType === "music" ||
        data.workType === "book" ||
        data.workType === "game"
      ) {
        setWorkType(data.workType);
      }
      setPhase("tags");
    } catch {
      setError("Could not reach the tag matcher.");
    } finally {
      setBusy(false);
    }
  }

  // Landing entry: a pitch arriving via URL auto-starts tag extraction,
  // so the home text box flows straight into the chips step. Mount-only
  // by design (props are fixed for the page lifetime); the ref guards
  // StrictMode's double effect so only one POST fires.
  // biome-ignore lint/correctness/useExhaustiveDependencies: mount-only auto-start
  useEffect(() => {
    if (autoStart && initialPitch.trim() !== "" && !autoStarted.current) {
      autoStarted.current = true;
      void extractTags();
    }
  }, []);

  const run = useCallback(async () => {
    setBusy(true);
    setError(null);
    setSteps([]);
    setPhase("running");
    try {
      const res = await fetch("/api/flow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pitchText,
          workType,
          tags,
          similarTitles: similarTitles
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        }),
      });
      const data = (await res.json()) as RunResponseBody & { error?: string };
      if (!res.ok) {
        setError(data.error ?? "The run failed.");
        setPhase("tags");
        return;
      }
      setSteps(data.steps ?? []);
      setResult(data.result);
      setPhase("done");
    } catch {
      setError("The run failed. The page is unaffected.");
      setPhase("tags");
    } finally {
      setBusy(false);
    }
  }, [pitchText, workType, tags, similarTitles]);

  return (
    <div className="mx-auto w-full max-w-[880px] px-6 py-12">
      {phase === "input" && (
        <section aria-label="Pitch input">
          <h1 className="font-serif text-3xl tracking-tight text-ink">
            What are you making?
          </h1>
          <p className="mt-2 max-w-prose text-body text-ink-2">
            Paste the idea. We read its tags, check them against real Qloo data,
            and show which audience it fits.
          </p>
          <textarea
            value={pitchText}
            onChange={(e) => setPitchText(e.target.value)}
            rows={6}
            placeholder="A tender sci-fi drama for people who like slow-burn stories, with a lonely and hopeful feel."
            className="mt-4 min-h-32 w-full resize-y border-2 border-outline bg-surface px-4 py-3 text-[15px] leading-relaxed text-ink placeholder:text-ink-3"
          />
          <div className="mt-4">
            <div>
              <label
                htmlFor="similar"
                className="block font-mono text-xs text-ink-3"
              >
                Similar to (optional, comma separated)
              </label>
              <input
                id="similar"
                value={similarTitles}
                onChange={(e) => setSimilarTitles(e.target.value)}
                placeholder="Moon, Arrival"
                className="mt-1 w-64 border-2 border-outline bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-3"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={extractTags}
            disabled={busy || pitchText.trim() === ""}
            className="btn-primary mt-6 px-6 py-3 text-sm"
          >
            {busy ? "Reading the pitch…" : "Read the tags"}
          </button>
          {error && (
            <p role="alert" className="mt-3 text-sm text-ink-2">
              {error}
            </p>
          )}
        </section>
      )}

      {phase === "tags" && (
        <section aria-label="Confirm tags">
          <p className="font-mono text-xs text-ink-3">Read as {workType}</p>
          <TagChips tags={tags} onChange={setTags} loading={busy} />
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={run}
              disabled={busy || matched < MIN_MATCHED_TAGS}
              className="btn-primary px-6 py-3 text-sm"
            >
              {busy ? "Running…" : "Run the analysis"}
            </button>
            <button
              type="button"
              onClick={() => setPhase("input")}
              className="btn-secondary px-5 py-3 text-sm"
            >
              Edit the pitch
            </button>
          </div>
          {error && (
            <p role="alert" className="mt-3 text-sm text-ink-2">
              {error}
            </p>
          )}
        </section>
      )}

      {phase === "running" && (
        <section aria-label="Run">
          <h2 className="text-lg tracking-tight text-ink">Working</h2>
          <ul className="mt-4 space-y-2">
            {steps.length === 0 && (
              <li className="font-mono text-sm text-ink-3">
                starting the run…
              </li>
            )}
            {steps.map((step) => (
              <li key={step.id} className="flex items-baseline gap-3">
                <span className="font-mono text-xs text-ink-3">{step.id}</span>
                <span className="text-[15px] text-ink">{step.label}</span>
                {step.detail !== undefined && (
                  <span className="font-mono text-xs text-ink-2">
                    {step.detail}
                  </span>
                )}
                {step.callId !== undefined && (
                  <a href={`#${step.callId}`} className="cite">
                    [e]
                  </a>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {phase === "done" && result !== null && (
        <section aria-label="Results">
          <div className="mb-6">
            <p className="font-mono text-xs text-ink-3">Run steps</p>
            <ul className="mt-2 space-y-1">
              {steps.map((step) => (
                <li key={step.id} className="font-mono text-xs text-ink-2">
                  {step.label} — {step.detail ?? "done"}
                </li>
              ))}
            </ul>
          </div>
          <FlowResultView result={result} />
          <div className="mt-10">
            <h3 className="text-base tracking-tight text-ink">Evidence</h3>
            <ul className="mt-2 divide-y divide-rule">
              {Object.entries(result.evidence).map(([id, line]) => (
                <li key={id} id={id} className="py-3">
                  <details>
                    <summary className="cursor-pointer font-mono text-xs text-ink-2">
                      {line.request.endpoint} · status {line.status}
                      {line.fromCache ? " · saved" : ""}
                      {line.truncated ? " · truncated" : ""}
                    </summary>
                    <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-all bg-paper p-3 font-mono text-xs text-ink-2">
                      {JSON.stringify(line.request.params)}
                      {"\n"}
                      {line.response}
                    </pre>
                  </details>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </div>
  );
}
