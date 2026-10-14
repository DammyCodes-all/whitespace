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
import { ChangeView } from "@/components/change";
import type { ChatbotView } from "@/components/chatbot-preview";
import { FlowCompareView } from "@/components/flow-compare";
import { GapsCard } from "@/components/flow-gaps";
import { FlowResultView } from "@/components/flow-result-view";
import { TagChips } from "@/components/tag-chips";
import LoadingState from "@/components/ui/loading-state";
import { MIN_MATCHED_TAGS } from "@/lib/config";
import type { FlowEvidence, FlowResult } from "@/lib/flow/contract";
import { parseSimilarTitles } from "@/lib/flow/similar-titles";
import type { FlowStepRow } from "@/lib/flow/view-types";
import type { ChangedRun } from "@/lib/pipeline/change";
import type { QlooCall, WorkType } from "@/lib/types";

type Phase = "input" | "tags" | "running" | "done";

interface RunResponseBody {
  result: FlowResult;
  steps: FlowStepRow[];
  stopped: boolean;
}

interface CompareResponseBody {
  chatbot: ChatbotView | null;
  error: string | null;
  calls: QlooCall[];
}

interface ChangeResponseBody {
  changed?: ChangedRun;
  error?: string;
}

function callToEvidence(call: QlooCall): FlowEvidence {
  return {
    request: { endpoint: call.endpoint, params: { ...call.params } },
    response: call.responseBody ?? call.responseSummary ?? "not captured",
    truncated: call.responseTruncated ?? call.responseBody === undefined,
    status: call.status,
    fromCache: call.fromCache,
  };
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
  const [qlooSuggestions, setQlooSuggestions] = useState<string[]>([]);
  const [suggestBusy, setSuggestBusy] = useState(false);
  /** True after the single-shot suggestions fetch settles (success or not). */
  const [suggestDone, setSuggestDone] = useState(false);
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
  // On-demand title check (explicit click only, never on keystroke):
  // informational — the run re-resolves everything at run time.
  const [checkBusy, setCheckBusy] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [checkResult, setCheckResult] = useState<{
    resolved: { query: string; name: string; qlooId: string }[];
    notFound: string[];
  } | null>(null);

  const matched = tags.filter((t) => t.status === "matched").length;
  const parsedSimilar = parseSimilarTitles(similarTitles);
  const autoStarted = useRef(false);

  /** Tap-to-add for a suggested title; dedupes case-insensitively. */
  function addSuggested(title: string) {
    const clean = title.trim();
    if (clean === "") return;
    const have = new Set(
      parseSimilarTitles(similarTitles).map((s) => s.toLowerCase()),
    );
    if (have.has(clean.toLowerCase())) return;
    // The list changed, so any earlier check is stale.
    setCheckResult(null);
    setSimilarTitles((prev) =>
      prev.trim() === "" ? clean : `${prev.replace(/\s*,\s*$/, "")}, ${clean}`,
    );
  }

  /** Explicit-click title check against Qloo; never runs on keystroke. */
  async function checkSimilarTitles() {
    const list = parseSimilarTitles(similarTitles);
    if (list.length === 0 || checkBusy) return;
    setCheckBusy(true);
    setCheckError(null);
    try {
      const res = await fetch("/api/titles/check", {
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
    } catch {
      setCheckError("Could not reach the title check.");
      setCheckResult(null);
    } finally {
      setCheckBusy(false);
    }
  }

  /** Qloo similar-title suggestions: single shot after tags load,
   *  never per keystroke. Silent on failure — suggestions are optional. */
  async function fetchTitleSuggestions(tagIds: string[], wt: WorkType) {
    if (tagIds.length === 0) return;
    setSuggestBusy(true);
    try {
      const res = await fetch("/api/titles/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagIds, workType: wt }),
      });
      const data = (await res.json()) as { suggestions?: unknown };
      setQlooSuggestions(
        res.ok && Array.isArray(data.suggestions)
          ? data.suggestions.filter(
              (t): t is string => typeof t === "string" && t.trim() !== "",
            )
          : [],
      );
    } catch {
      setQlooSuggestions([]);
    } finally {
      setSuggestBusy(false);
      setSuggestDone(true);
    }
  }

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
      const nextTags = data.tags ?? [];
      setTags(nextTags);
      setQlooSuggestions([]);
      setSuggestDone(false);
      const nextType =
        data.workType === "film" ||
        data.workType === "music" ||
        data.workType === "book" ||
        data.workType === "game"
          ? data.workType
          : workType;
      setWorkType(nextType);
      setPhase("tags");
      // Single shot: matched tags' Qloo ids feed one suggestions call.
      void fetchTitleSuggestions(
        nextTags
          .filter((t) => t.status === "matched" && t.qlooId !== undefined)
          .map((t) => t.qlooId as string),
        nextType,
      );
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

  // Compare sidecar (§6.11): the same pitch answered with no Qloo tools.
  // Runs after the result lands so the measured verdict never waits on
  // the chatbot; either side may fail independently. The per-result
  // guard (not a cleanup flag) is what survives StrictMode's double
  // effect in dev: the remount sees the same result and skips, so one
  // run spends one LLM call plus one mark batch, never two.
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

  async function checkChange() {
    if (result === null || constraint.trim() === "" || changeBusy) return;
    setChangeBusy(true);
    setChangeError(null);
    try {
      const res = await fetch("/api/flow/change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          result: { ...result, evidence: {} },
          constraint: constraint.trim(),
        }),
      });
      const data = (await res.json()) as ChangeResponseBody;
      if (!res.ok || data.changed === undefined) {
        setChangeError(data.error ?? "The recheck failed.");
        return;
      }
      setChanged(data.changed);
    } catch {
      setChangeError("The recheck failed. The run above is unaffected.");
    } finally {
      setChangeBusy(false);
    }
  }

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
          similarTitles: parseSimilarTitles(similarTitles),
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
      setChatbot(null);
      setChatbotError(null);
      setCompareCalls([]);
      setCompareLoaded(false);
      setChanged(null);
      setChangeError(null);
      setPhase("done");
    } catch {
      setError("The run failed. The page is unaffected.");
      setPhase("tags");
    } finally {
      setBusy(false);
    }
  }, [pitchText, workType, tags, similarTitles]);

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-12 sm:px-8">
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
            className="mt-4 min-h-32 w-full resize-y rounded-2xl border-2 border-outline bg-surface px-4 py-3 text-[15px] leading-relaxed text-ink shadow-[4px_4px_0_var(--outline)] placeholder:text-ink-3"
          />
          <div className="mt-4">
            <div>
              <label
                htmlFor="similar"
                className="block font-mono text-xs text-ink-3"
              >
                Similar to (optional, comma separated — suggestions appear after
                reading the tags)
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
          {busy ? (
            <output aria-live="polite" className="mt-6 block">
              <LoadingState label="Running pitch" variant="Dots" />
            </output>
          ) : (
            <button
              type="button"
              onClick={extractTags}
              disabled={pitchText.trim() === ""}
              className="btn-primary mt-6 px-6 py-3 text-sm"
            >
              Read the tags
            </button>
          )}
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
          <section aria-label="Similar-to titles" className="mt-6">
            <h2 className="text-lg tracking-tight text-ink">
              Similar-to titles
            </h2>
            <p className="mt-1 max-w-prose text-body text-ink-2">
              What the run will resolve against Qloo. Check now for an early
              look — the run re-checks everything, so this never decides
              anything.
            </p>
            <label
              htmlFor="similar-tags"
              className="mt-3 block font-mono text-xs text-ink-3"
            >
              Comma separated
            </label>
            <div className="mt-1 flex flex-col gap-2 sm:flex-row">
              <input
                id="similar-tags"
                value={similarTitles}
                onChange={(e) => {
                  setSimilarTitles(e.target.value);
                  setCheckResult(null);
                }}
                placeholder="Moon, Arrival"
                className="min-w-0 flex-1 border-2 border-outline bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-3"
              />
              <button
                type="button"
                onClick={checkSimilarTitles}
                disabled={parsedSimilar.length === 0 || checkBusy}
                className="btn-secondary shrink-0 px-5 py-2 text-sm"
              >
                {checkBusy ? "Checking…" : "Check in Qloo"}
              </button>
            </div>
            {parsedSimilar.length > 0 && (
              <ul
                aria-label="Titles to check"
                className="mt-3 flex flex-wrap gap-2"
              >
                {[...new Set(parsedSimilar)].map((title) => (
                  <li
                    key={title}
                    className="border-2 border-outline bg-paper px-3 py-1 font-mono text-xs text-ink-2"
                  >
                    {title}
                  </li>
                ))}
              </ul>
            )}
            {checkError !== null && (
              <p role="alert" className="mt-3 text-sm text-ink-2">
                {checkError}
              </p>
            )}
            {checkResult !== null && (
              <div className="mt-3 space-y-2">
                {checkResult.resolved.length > 0 && (
                  <ul
                    aria-label="Found in Qloo"
                    className="flex flex-wrap gap-2"
                  >
                    {checkResult.resolved.map((hit) => (
                      <li
                        key={hit.qlooId}
                        className="border-2 border-outline bg-strong px-3 py-1 font-mono text-xs text-ink"
                      >
                        ✓ {hit.name}
                      </li>
                    ))}
                  </ul>
                )}
                {checkResult.notFound.length > 0 && (
                  <ul
                    aria-label="Not found in Qloo"
                    className="flex flex-wrap gap-2"
                  >
                    {checkResult.notFound.map((title) => (
                      <li
                        key={title}
                        className="border-2 border-outline bg-weak px-3 py-1 font-mono text-xs text-ink"
                      >
                        ✕ {title} — not in Qloo
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </section>
          {suggestBusy ? (
            <output aria-live="polite" className="mt-6 block">
              <LoadingState
                label="Finding titles sharing your tags"
                variant="Dots"
              />
            </output>
          ) : qlooSuggestions.length > 0 ? (
            <section aria-label="Titles sharing your tags" className="mt-6">
              <h2 className="text-lg tracking-tight text-ink">
                Titles sharing your tags?
              </h2>
              <p className="mt-1 max-w-prose text-body text-ink-2">
                From the taste database — titles overlapping your matched words.
                Tap to add; each is verified at the run.
              </p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {qlooSuggestions.map((title) => {
                  const added = similarTitles
                    .split(",")
                    .map((s) => s.trim().toLowerCase())
                    .includes(title.trim().toLowerCase());
                  if (added) return null;
                  return (
                    <li key={title}>
                      <button
                        type="button"
                        onClick={() => addSuggested(title)}
                        disabled={busy}
                        className="btn-secondary px-4 py-2 text-sm"
                      >
                        + {title}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : (
            suggestDone && (
              <p className="mt-6 max-w-prose text-body text-ink-2">
                No suggestions this time — the database had nothing overlapping
                your words. Type your own above; Check verifies each.
              </p>
            )
          )}
          <div className="mt-6 flex flex-wrap items-center gap-4">
            {busy ? (
              <output aria-live="polite" className="block py-1">
                <LoadingState label="Running pitch" variant="Dots" />
              </output>
            ) : (
              <button
                type="button"
                onClick={run}
                disabled={matched < MIN_MATCHED_TAGS}
                className="btn-primary px-6 py-3 text-sm"
              >
                Run the analysis
              </button>
            )}
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
          <output aria-live="polite" className="block py-2">
            <LoadingState label="Running pitch" variant="Dots" />
          </output>
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
          <section className="rounded-[18px] border-2 border-outline bg-surface p-5 shadow-[4px_4px_0_var(--outline)] sm:p-7">
            <p className="font-mono text-xs uppercase tracking-[0.14em] text-ink-3">
              The idea
            </p>
            <p className="mt-3 max-w-3xl font-serif text-2xl leading-tight tracking-tight text-ink sm:text-3xl">
              {result.pitch}
            </p>
            <p className="mt-3 font-mono text-xs text-ink-3">
              {result.type} · live run · {result.qlooCalls.total} Qloo calls
            </p>
          </section>

          <div className="mb-6 mt-8">
            <p className="font-mono text-xs text-ink-3">Run steps</p>
            <ul className="mt-2 space-y-1">
              {steps.map((step) => (
                <li key={step.id} className="font-mono text-xs text-ink-2">
                  {step.label} — {step.detail ?? "done"}
                </li>
              ))}
            </ul>
          </div>
          <FlowResultView result={result} orangeVerdict={result.surprise} />

          {result.gaps.length > 0 && (
            <div className="mt-4 grid gap-4 md:grid-cols-12">
              <div className="md:col-span-7">
                <GapsCard group={result.gaps[0]} />
              </div>
              <div className="md:col-span-5">
                <h2 className="text-lg tracking-tight text-ink">
                  Change and re-check
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-ink-2">
                  A constraint can change the pitch, but the new version has to
                  score higher to land.
                </p>
                <form
                  className="mt-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void checkChange();
                  }}
                >
                  <label
                    htmlFor="flow-constraint"
                    className="block font-mono text-xs text-ink-3"
                  >
                    Limit (for example a smaller budget)
                  </label>
                  <div className="mt-1 flex flex-col gap-2 sm:flex-row">
                    <input
                      id="flow-constraint"
                      value={constraint}
                      onChange={(e) => setConstraint(e.target.value)}
                      maxLength={140}
                      placeholder="Lower budget"
                      className="min-w-0 flex-1 border-2 border-outline bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-3"
                    />
                    <button
                      type="submit"
                      disabled={constraint.trim() === "" || changeBusy}
                      className="btn-primary shrink-0 px-5 py-2 text-sm"
                    >
                      {changeBusy ? "Checking…" : "Check change"}
                    </button>
                  </div>
                </form>
                {changeError !== null && (
                  <p role="alert" className="mt-3 text-sm text-ink-2">
                    {changeError}
                  </p>
                )}
                {changed !== null && (
                  <div className="mt-4">
                    <ChangeView changed={changed} />
                  </div>
                )}
              </div>
            </div>
          )}
          {result.gaps.slice(1).map((group) => (
            <div key={group.audienceId} className="mt-4">
              <GapsCard group={group} />
            </div>
          ))}

          {compareLoaded ? (
            <FlowCompareView
              result={result}
              similarTitles={parseSimilarTitles(similarTitles)}
              chatbot={chatbot}
              error={chatbotError}
            />
          ) : (
            <output aria-live="polite" className="mt-12 block">
              <LoadingState label="Checking the plain chatbot" variant="Dots" />
            </output>
          )}

          <div className="mt-10">
            <h3 className="text-base tracking-tight text-ink">Evidence</h3>
            <ul className="mt-2 divide-y divide-rule">
              {Object.entries({
                ...result.evidence,
                ...Object.fromEntries(
                  [...compareCalls, ...(changed?.calls ?? [])].map((call) => [
                    call.id,
                    callToEvidence(call),
                  ]),
                ),
              }).map(([id, line]) => (
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
