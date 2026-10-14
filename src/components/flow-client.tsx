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
  /** Title-gift preview: confirmed Qloo tastes off the checked titles. */
  const [titleTags, setTitleTags] = useState<
    {
      qlooId: string;
      label: string;
      sourceTitleId: string | null;
      sourceTitleName: string | null;
    }[]
  >([]);
  const [titleTagsBusy, setTitleTagsBusy] = useState(false);
  /** True after the preview fetch settles (success or not). */
  const [titleTagsDone, setTitleTagsDone] = useState(false);
  /** Gifts the fit-pick cut as unfitting the pitch (restorable). */
  const [cutGifts, setCutGifts] = useState<
    {
      qlooId: string;
      label: string;
      sourceTitleId: string | null;
      sourceTitleName: string | null;
    }[]
  >([]);
  const [showCutGifts, setShowCutGifts] = useState(false);
  /** Why the title-gift preview came back empty (null = not empty). */
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

  /** Chip-step fetches with a hard ceiling: Qloo slowness must fail
   *  honest (empty/error note), never spin forever. */
  async function fetchWithTimeout(
    url: string,
    init: RequestInit,
    ms = 30000,
  ): Promise<Response> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms);
    try {
      return await fetch(url, { ...init, signal: ctrl.signal });
    } finally {
      clearTimeout(timer);
    }
  }

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
    setTitleTags([]);
    setCutGifts([]);
    setShowCutGifts(false);
    setPreviewNote(null);
    setTitleTagsDone(false);
    setSimilarTitles((prev) =>
      prev.trim() === "" ? clean : `${prev.replace(/\s*,\s*$/, "")}, ${clean}`,
    );
  }

  /** Remove one title from the similar-to list; check output goes stale. */
  function removeSimilar(title: string) {
    const keep = parseSimilarTitles(similarTitles).filter(
      (s) => s.toLowerCase() !== title.trim().toLowerCase(),
    );
    setCheckResult(null);
    setTitleTags([]);
    setCutGifts([]);
    setShowCutGifts(false);
    setPreviewNote(null);
    setTitleTagsDone(false);
    setSimilarTitles(keep.join(", "));
  }

  /** Unpick one title gift; it leaves the run's picked ids. */
  function removeTitleTag(qlooId: string) {
    setTitleTags((prev) => prev.filter((t) => t.qlooId !== qlooId));
  }

  /** Title-gift preview: top Qloo tastes off the checked titles, one
   *  shot after an explicit check, never per keystroke. Silent on
   *  failure — gifts are optional, pitch words still score. */
  async function fetchTitleTags(names: string[], wt: WorkType) {
    if (names.length === 0) return;
    setTitleTagsBusy(true);
    try {
      const res = await fetchWithTimeout("/api/titles/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titles: names, workType: wt }),
      });
      const data = (await res.json()) as {
        tags?: {
          qlooId: string;
          label: string;
          sourceTitleId: string | null;
          sourceTitleName: string | null;
        }[];
        note?: unknown;
      };
      setPreviewNote(
        res.ok && typeof data.note === "string" ? data.note : null,
      );
      setTitleTags(
        res.ok && Array.isArray(data.tags)
          ? data.tags.filter(
              (t) =>
                typeof t.qlooId === "string" &&
                t.qlooId.trim() !== "" &&
                typeof t.label === "string" &&
                t.label.trim() !== "",
            )
          : [],
      );
      // Fit-pick: the model drops gifts the pitch does not earn (one
      // LLM call, zero Qloo). Fail-open — failures keep every gift
      // and the user still confirms each chip.
      if (res.ok && Array.isArray(data.tags) && data.tags.length > 0) {
        try {
          const pickRes = await fetchWithTimeout("/api/titles/pick", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              pitchText,
              candidates: data.tags.map((t) => ({
                qlooId: t.qlooId,
                label: t.label,
                sourceTitleName: t.sourceTitleName,
              })),
            }),
          });
          const pick = (await pickRes.json()) as { keptIds?: unknown };
          if (
            pickRes.ok &&
            Array.isArray(pick.keptIds) &&
            pick.keptIds.length < data.tags.length
          ) {
            const keep = new Set(
              pick.keptIds.filter(
                (id): id is string =>
                  typeof id === "string" && id.trim() !== "",
              ),
            );
            setCutGifts(data.tags.filter((t) => !keep.has(t.qlooId)));
            setShowCutGifts(false);
            setTitleTags((prev) => prev.filter((t) => keep.has(t.qlooId)));
          } else {
            setCutGifts([]);
          }
        } catch {
          setCutGifts([]);
        }
      } else {
        setCutGifts([]);
      }
    } catch {
      setTitleTags([]);
      setCutGifts([]);
      setPreviewNote("preview-failed");
    } finally {
      setTitleTagsBusy(false);
      setTitleTagsDone(true);
    }
  }

  /** Explicit-click title check against Qloo; never runs on keystroke. */
  async function checkSimilarTitles() {
    const list = parseSimilarTitles(similarTitles);
    if (list.length === 0 || checkBusy) return;
    setCheckBusy(true);
    setCheckError(null);
    try {
      const res = await fetchWithTimeout("/api/titles/check", {
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
      // Preview the titles' gifts for the single chip row; the run
      // rebuilds the same pool and applies the confirmed picks.
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
        void fetchTitleTags(resolvedNames, workType);
        // Suggestions seed from the just-checked titles' ids, so they
        // only run once the user has typed (and verified) a title.
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

  /** Entity-seeded suggestions: only off the user's own checked
   *  titles (their Qloo ids), never off pitch tags, never per
   *  keystroke — the caller fires this after an explicit Check.
   *  Silent on failure — suggestions are optional. */
  async function fetchTitleSuggestions(
    entityIds: string[],
    excludeNames: string[],
    wt: WorkType,
  ) {
    if (entityIds.length === 0) {
      setQlooSuggestions([]);
      setSuggestDone(true);
      return;
    }
    setSuggestBusy(true);
    try {
      const res = await fetchWithTimeout("/api/titles/related", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityIds, excludeNames, workType: wt }),
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
      setPhase("tags");
      const nextType =
        data.workType === "film" ||
        data.workType === "music" ||
        data.workType === "book" ||
        data.workType === "game"
          ? data.workType
          : workType;
      setWorkType(nextType);
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
          pickedTagIds: titleTags.map((t) => t.qlooId),
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
  }, [pitchText, workType, tags, similarTitles, titleTags]);

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-12 sm:px-8">
      {phase === "input" && (
        <section aria-label="Pitch input">
          <h1 className="font-serif text-3xl tracking-tight text-ink">
            What are you making?
          </h1>
          <p className="mt-2 max-w-prose text-body text-ink-2">
            Explain it in detail — the world, the characters, what happens, what
            it is about underneath. More detail means better tags and a fairer
            verdict. We read its tags, check them against real Qloo data, and
            show which audience it fits.
          </p>
          <textarea
            value={pitchText}
            onChange={(e) => setPitchText(e.target.value)}
            rows={10}
            placeholder="Frankie drove getaway cars for twenty years and never lost a crew. Now her old crew is back with one last job. Gritty but tender, slow-burn. About loyalty and aging out of a life, set in a present-day port town that lives off smuggling crews. A heist movie with family drama at its core, not a glossy action romp or a comedy."
            className="mt-4 min-h-32 w-full resize-y rounded-2xl border-2 border-outline bg-surface px-4 py-3 text-[15px] leading-relaxed text-ink shadow-[4px_4px_0_var(--outline)] placeholder:text-ink-3"
          />
          <div className="mt-4">
            <div>
              <label
                htmlFor="similar"
                className="block font-mono text-xs text-ink-3"
              >
                Similar to (optional here — required before the run, comma
                separated — suggestions appear after you check them)
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
          <TagChips
            tags={tags}
            onChange={setTags}
            loading={busy}
            extraMatched={titleTags.length}
            extraChips={titleTags.map((t) => ({
              key: t.qlooId,
              label: t.label,
              badge: t.sourceTitleName ?? "title",
              onRemove: () => removeTitleTag(t.qlooId),
            }))}
          />
          {titleTagsBusy && (
            <output aria-live="polite" className="mt-4 block">
              <LoadingState label="Reading the titles' tags" variant="Dots" />
            </output>
          )}
          {!titleTagsBusy &&
            titleTagsDone &&
            checkResult !== null &&
            checkResult.resolved.length > 0 &&
            titleTags.length === 0 &&
            cutGifts.length === 0 && (
              <p className="mt-4 max-w-prose text-body text-ink-2">
                {previewNote === "no-tastes" &&
                  "Qloo holds no taste data for these titles — only pitch words will score."}
                {previewNote === "all-generic" &&
                  "These titles' top tastes were all generic (half the controls hold them) — only your sharper pitch words will score."}
                {previewNote === "preview-failed" &&
                  "Couldn't read the titles' tastes — only pitch words will score. Check again to retry."}
                {(previewNote === null ||
                  previewNote === "ok" ||
                  previewNote === "unresolved") &&
                  "The checked titles added no tags — only pitch words will score. The run still needs at least 1 similar title."}
              </p>
            )}
          {!titleTagsBusy && titleTagsDone && cutGifts.length > 0 && (
            <div className="mt-4">
              <p className="max-w-prose text-body text-ink-2">
                {cutGifts.length} gift{cutGifts.length === 1 ? "" : "s"} cut as
                unfitting your pitch — restore any that should score.
              </p>
              <button
                type="button"
                onClick={() => setShowCutGifts((v) => !v)}
                className="btn-secondary mt-2 px-4 py-2 text-sm"
              >
                {showCutGifts ? "Hide cut gifts" : "Show cut gifts"}
              </button>
              {showCutGifts && (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {cutGifts.map((gift) => (
                    <li key={gift.qlooId}>
                      <button
                        type="button"
                        onClick={() => {
                          setTitleTags((prev) =>
                            prev.some((t) => t.qlooId === gift.qlooId)
                              ? prev
                              : [...prev, gift],
                          );
                          setCutGifts((prev) =>
                            prev.filter((t) => t.qlooId !== gift.qlooId),
                          );
                        }}
                        disabled={busy}
                        className="btn-secondary px-4 py-2 text-sm"
                      >
                        + {gift.label}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <section aria-label="Similar-to titles" className="mt-6">
            <h2 className="text-lg tracking-tight text-ink">
              Similar-to titles
            </h2>
            <p className="mt-1 max-w-prose text-body text-ink-2">
              What the run will resolve against Qloo. Name at least 1 — its
              tastes ground the tags. Check now for an early look — the run
              re-checks everything, so this never decides anything.
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
                  setTitleTags([]);
                  setCutGifts([]);
                  setShowCutGifts(false);
                  setPreviewNote(null);
                  setTitleTagsDone(false);
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
                {checkBusy
                  ? "Checking & refreshing…"
                  : "Check titles & refresh tags"}
              </button>
            </div>
            {checkResult === null &&
              !checkBusy &&
              parsedSimilar.length > 0 &&
              (titleTagsDone || suggestDone) && (
                <p className="mt-3 max-w-prose text-body text-ink-2">
                  Titles changed — check again to refresh tags and suggestions.
                </p>
              )}
            {parsedSimilar.length > 0 && (
              <ul
                aria-label="Titles to check"
                className="mt-3 flex flex-wrap gap-2"
              >
                {[...new Set(parsedSimilar)].map((title) => (
                  <li
                    key={title}
                    className="flex items-center gap-2 border-2 border-outline bg-paper px-3 py-1 font-mono text-xs text-ink-2"
                  >
                    <span>{title}</span>
                    <button
                      type="button"
                      onClick={() => removeSimilar(title)}
                      disabled={busy}
                      aria-label={`Remove ${title}`}
                      className="text-ink-3 hover:text-ink"
                    >
                      ✕
                    </button>
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
              <LoadingState label="Finding titles like yours" variant="Dots" />
            </output>
          ) : qlooSuggestions.length > 0 ? (
            <section aria-label="Similar to your idea" className="mt-6">
              <h2 className="text-lg tracking-tight text-ink">
                Similar to your idea?
              </h2>
              <p className="mt-1 max-w-prose text-body text-ink-2">
                From the taste database — titles related to the ones you typed.
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
                No suggestions this time — the database had nothing related to
                your titles. Type your own above; Check verifies each.
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
                disabled={
                  matched + titleTags.length < MIN_MATCHED_TAGS ||
                  parsedSimilar.length < 1
                }
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
          {parsedSimilar.length < 1 && (
            <output className="mt-3 block font-mono text-xs text-clay">
              Add at least 1 similar title — the run grounds its tags in it, and
              the pool gate still applies.
            </output>
          )}
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
