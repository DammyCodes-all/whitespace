"use client";

/**
 * The run's data and actions: every leg's state, the same routes the
 * stepped flow calls, and the local edits that never spend a call. The
 * orb cycle itself lives in `use-orb-bridge`, the results sidecars in
 * `use-result-sidecars`, and the presentation in `orb-flow.tsx` plus
 * the `leg-*` modules — so this file is the run's brain and nothing
 * else.
 *
 * Spec ref: §5 (the run reports itself as it goes).
 */

import { useTransitionRouter } from "next-view-transitions";
import { type RefObject, useRef, useState } from "react";
import type { CheckResult, Leg, TitleGift } from "@/components/orb/types";
import { useOrbBridge } from "@/components/orb/use-orb-bridge";
import {
  type ResultSidecars,
  useResultSidecars,
} from "@/components/orb/use-result-sidecars";
import {
  CLEAR_FINALE_MS,
  CLEAR_FINALE_REDUCED_MS,
} from "@/components/ui/orb/timeline";
import type { OrbHandle, OrbPhase } from "@/components/ui/orb/types";
import { MIN_MATCHED_TAGS } from "@/lib/config";
import type { FlowResult, FlowTag } from "@/lib/flow/contract";
import {
  parseSimilarTitles,
  titleVerdictKey,
} from "@/lib/flow/similar-titles";
import type { FlowStepRow } from "@/lib/flow/view-types";
import {
  CHECK_TAIL_LINE,
  legPrompt,
  legWorkingMessage,
  receiptLine,
  runReceipt,
  SETUP_LINE,
} from "@/lib/orb/orb-status";
import type { WorkType } from "@/lib/types";

export interface OrbRun extends ResultSidecars {
  /** Which leg the run is on. */
  leg: Leg;
  /** True between legs: the old UI is gone and the orb is gliding
   *  back to centre before the parked leg settles (see settleAdvance). */
  returning: boolean;
  /** Play the parked leg advance now that the orb is back at centre. */
  settleAdvance: () => void;
  /** The one honest line under the orb — errors and interruption only. */
  status: string;
  error: string | null;
  interrupted: boolean;
  pitchText: string;
  /** Honest line for the orb's think phase — the work in flight. */
  workLabel: string | null;
  /** True while the orb is visibly working (launch through unfold).
   *  Every primary action waits for the waiting pose. */
  working: boolean;

  tags: FlowTag[];
  similarTitles: string;
  /** Parsed, blank-free titles — what Check and the run send. */
  similar: string[];

  titleTags: TitleGift[];
  titleTagsBusy: boolean;
  titleTagsDone: boolean;
  cutGifts: TitleGift[];
  showCutGifts: boolean;
  previewNote: string | null;
  /** Titles the last explicit Check resolved; null before the first. */
  checkedCount: number | null;
  checkBusy: boolean;
  checkError: string | null;
  checkResult: CheckResult | null;

  suggestions: string[];
  suggestBusy: boolean;
  suggestDone: boolean;

  steps: FlowStepRow[];
  result: FlowResult | null;

  /** The pool gate: 3 found tags (pitch + title gifts) and one title. */
  canContinue: boolean;

  /** Orb bridge — wire these into MorphOrb. */
  handlePhase: (p: OrbPhase) => void;
  entrySubmit: (text: string) => Promise<string>;
  /** Arm the entry leg's state before the runtime starts (autostart). */
  armEntry: (pitch: string) => void;
  /** Re-run the leg that last failed or was interrupted. */
  retry: () => void;

  setTags: (tags: FlowTag[]) => void;
  onSimilarTitlesChange: (value: string) => void;
  onAddSuggested: (title: string) => void;
  onRemoveSimilar: (title: string) => void;
  onRemoveTitleTag: (qlooId: string) => void;
  onToggleCutGifts: () => void;
  onRestoreGift: (gift: TitleGift) => void;
  onCheck: () => void;
  onContinueToTitles: () => void;
  onReviewFullSet: () => void;
  onRun: () => void;
  onEditPitch: () => void;
}

export function useOrbRun({
  orbRef,
  homeHref,
  speed = 1,
}: {
  orbRef: RefObject<OrbHandle | null>;
  /** Where Edit-the-pitch hands back to (the entry that started this). */
  homeHref: string;
  /** Orb pace multiplier (1 = live). Scales the finale wait like the
   *  runtime scales its tracks, so the result never jumps a slow orb. */
  speed?: number;
}): OrbRun {
  const router = useTransitionRouter();
  const [leg, setLeg] = useState<Leg>("entry");
  /** Between-leg beat: the advance parks here while the orb returns
   *  to centre, then the host settles it (see settleAdvance). */
  const [returning, setReturning] = useState(false);
  const pendingLeg = useRef<Leg | null>(null);
  /** True when the scored run's cycle already started on the press
   *  (see requestScore) — settleAdvance must not start it twice. */
  const runPulseRef = useRef(false);
  const {
    status,
    error,
    interrupted,
    workLabel,
    working,
    setWorkLabel,
    setStatus,
    setError,
    beginLeg,
    askLeg,
    askQuiet,
    beatWork,
    beatSettle,
    handlePhase,
    setRetry,
    retry,
  } = useOrbBridge(orbRef);

  const [pitchText, setPitchText] = useState("");
  const [workType, setWorkType] = useState<WorkType>("film");
  const [tags, setTags] = useState<FlowTag[]>([]);
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
  const [checkBusy, setCheckBusy] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [checkResult, setCheckResult] = useState<CheckResult | null>(null);
  const [steps, setSteps] = useState<FlowStepRow[]>([]);
  const [result, setResult] = useState<FlowResult | null>(null);

  const sidecars = useResultSidecars({ leg, result });
  const resetSidecars = sidecars.reset;

  const matched = tags.filter((t) => t.status === "matched").length;
  const parsedSimilar = parseSimilarTitles(similarTitles);

  /** Plain fetch, no client timeout — Qloo slowness resolves as data
   *  or a real error, never a client abort. */
  async function chipFetch(url: string, init: RequestInit): Promise<Response> {
    return fetch(url, init);
  }

  /* ── leg work: the same routes the stepped flow uses ── */

  async function postTags(pitch: string): Promise<string> {
    const res = await fetch("/api/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pitchText: pitch }),
    });
    const data = (await res.json()) as {
      tags?: FlowTag[];
      workType?: WorkType;
      error?: string;
    };
    if (!res.ok) {
      setError(data.error ?? "Could not read the pitch tags.");
      throw new Error("tags-failed");
    }
    const nextTags = data.tags ?? [];
    setTags(nextTags);
    const nextType =
      data.workType === "film" ||
      data.workType === "music" ||
      data.workType === "book" ||
      data.workType === "game"
        ? data.workType
        : workType;
    setWorkType(nextType);
    setLeg("tags");
    setStatus(legPrompt("tags"));
    return receiptLine(
      "tags",
      nextTags.filter((t) => t.status === "matched").length,
    );
  }

  /** Entry from the orb's own form: the runtime already started the
   *  cycle, so this only arms the refs and does the work. */
  async function entrySubmit(text: string): Promise<string> {
    const trimmed = text.trim();
    if (trimmed === "") return "Start with a sentence about what you make.";
    beginLeg(legWorkingMessage("entry"));
    setRetry(() => askEntry(trimmed));
    setPitchText(trimmed);
    try {
      return await postTags(trimmed);
    } catch {
      return "That step failed — retry below.";
    }
  }

  function askEntry(pitch: string) {
    const trimmed = pitch.trim();
    if (trimmed === "") return;
    setPitchText(trimmed);
    askLeg({
      text: trimmed,
      working: legWorkingMessage("entry"),
      end: "wait",
      run: () => postTags(trimmed),
      retry: () => askEntry(trimmed),
    });
  }

  async function fetchTitleTags(names: string[], wt: WorkType) {
    if (names.length === 0) return;
    setTitleTagsBusy(true);
    try {
      const res = await chipFetch("/api/titles/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titles: names, workType: wt }),
      });
      const data = (await res.json()) as {
        tags?: TitleGift[];
        note?: unknown;
      };
      setPreviewNote(
        res.ok && typeof data.note === "string" ? data.note : null,
      );
      const gifts = (
        res.ok && Array.isArray(data.tags) ? data.tags : []
      ).filter(
        (t) =>
          typeof t.qlooId === "string" &&
          t.qlooId.trim() !== "" &&
          typeof t.label === "string" &&
          t.label.trim() !== "",
      );
      setTitleTags(gifts);
      if (gifts.length > 0) {
        try {
          const pickRes = await chipFetch("/api/titles/pick", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              pitchText,
              candidates: gifts.map((t) => ({
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
            pick.keptIds.length < gifts.length
          ) {
            const keep = new Set(
              pick.keptIds.filter(
                (id): id is string =>
                  typeof id === "string" && id.trim() !== "",
              ),
            );
            setCutGifts(gifts.filter((t) => !keep.has(t.qlooId)));
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
      const res = await chipFetch("/api/titles/related", {
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

  /** Keep the previous verdicts for titles still in the box, and fold
   *  a fresh batch in. Verdicts for removed titles drop out. */
  function mergeVerdicts(
    prev: CheckResult | null,
    list: string[],
    resolved: CheckResult["resolved"],
    notFound: string[],
  ): CheckResult {
    const keys = new Set(list.map(titleVerdictKey));
    const keptResolved = (prev?.resolved ?? []).filter(
      (r) => typeof r.query === "string" && keys.has(titleVerdictKey(r.query)),
    );
    const keptNotFound = (prev?.notFound ?? []).filter((n) =>
      keys.has(titleVerdictKey(n)),
    );
    return {
      resolved: [...keptResolved, ...resolved],
      notFound: [...keptNotFound, ...notFound],
    };
  }

  async function postCheck(): Promise<string> {
    const list = parseSimilarTitles(similarTitles);
    setCheckError(null);
    // Only titles without a verdict go out — greens stay green with no
    // new call spent on them.
    const covered = new Set<string>();
    if (checkResult !== null) {
      for (const r of checkResult.resolved) {
        if (typeof r.query === "string") covered.add(titleVerdictKey(r.query));
      }
      for (const n of checkResult.notFound) covered.add(titleVerdictKey(n));
    }
    const fresh = list.filter((t) => !covered.has(titleVerdictKey(t)));
    if (fresh.length === 0) {
      const merged = mergeVerdicts(checkResult, list, [], []);
      setCheckResult(
        merged.resolved.length === 0 && merged.notFound.length === 0
          ? null
          : merged,
      );
      const line = receiptLine("titles", merged.resolved.length, merged.notFound.length);
      setStatus(`${line} Nothing new — every title here is already checked.`);
      return `${line} Nothing new.`;
    }
    try {
      const res = await chipFetch("/api/titles/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titles: fresh, workType }),
      });
      const data = (await res.json()) as {
        resolved?: { query: string; name: string; qlooId: string }[];
        notFound?: string[];
        error?: string;
      };
      if (!res.ok) {
        // Keep the previous verdicts — a failed call must not wipe
        // greens the run already earned.
        setCheckError(data.error ?? "Could not check the titles.");
        throw new Error("check-failed");
      }
      const resolved = Array.isArray(data.resolved) ? data.resolved : [];
      const notFound = Array.isArray(data.notFound) ? data.notFound : [];
      const merged = mergeVerdicts(checkResult, list, resolved, notFound);
      setCheckResult(merged);
      setTitleTags([]);
      setCutGifts([]);
      setShowCutGifts(false);
      setPreviewNote(null);
      setTitleTagsDone(false);
      setQlooSuggestions([]);
      setSuggestDone(false);
      // Gifts and suggestions rebuild from the full merged set, so the
      // kept titles' tastes are never silently dropped. They belong to
      // the Check (spec §6.1 — one call chained to the explicit Check),
      // so the cycle's work promise waits for them: the orb never says
      // "Over to you." while these are still in flight. Both helpers
      // swallow their own errors, so this cannot fail the cycle.
      const names = merged.resolved
        .map((r) => r.name)
        .filter((n): n is string => typeof n === "string" && n.trim() !== "");
      if (names.length > 0) {
        // The tail belongs to the Check: step the orb's line with it so
        // its state never goes stale mid-cycle (§5, §6.1).
        setWorkLabel(CHECK_TAIL_LINE);
        await Promise.all([
          fetchTitleTags(names, workType),
          fetchTitleSuggestions(
            merged.resolved
              .map((r) => r.qlooId)
              .filter(
                (id): id is string => typeof id === "string" && id.trim() !== "",
              ),
            parseSimilarTitles(similarTitles),
            workType,
          ),
        ]);
      } else {
        setTitleTagsDone(true);
        setSuggestDone(true);
      }
      const line = receiptLine("titles", merged.resolved.length, merged.notFound.length);
      setStatus(`${line} Tap suggestions to add, Done when set.`);
      return `${line} Done when set.`;
    } catch (e) {
      if (e instanceof Error && e.message === "check-failed") throw e;
      setCheckError("Could not reach the title check.");
      throw new Error("check-failed");
    }
  }

  function askCheck() {
    const list = parseSimilarTitles(similarTitles);
    if (list.length === 0 || checkBusy) return;
    setCheckBusy(true);
    // Quiet cycle: the orb thinks from its current frame and resolves
    // back to waiting — Check refreshes inside the titles leg, so it
    // never replays the leg's box morph.
    const started = askQuiet({
      text: list.join(", "),
      working: legWorkingMessage("titles", list.join(", ")),
      end: "wait",
      run: async () => {
        try {
          return await postCheck();
        } finally {
          setCheckBusy(false);
        }
      },
      retry: askCheck,
    });
    if (!started) setCheckBusy(false);
  }

  async function postRun(): Promise<string> {
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
    const data = (await res.json()) as {
      result?: FlowResult;
      steps?: FlowStepRow[];
      error?: string;
    };
    if (!res.ok || data.result === undefined) {
      setError(data.error ?? "The run failed.");
      throw new Error("run-failed");
    }
    setSteps(data.steps ?? []);
    setResult(data.result);
    resetSidecars();
    return runReceipt(data.result.verdict);
  }

  /** The scored run's work: fetch the result, then let the clear
   *  finale (green flash, dissolve) play out before the result takes
   *  over. Bounded wait on receipt — never gated on the animation,
   *  so a dead runtime cannot strand the flow. */
  async function runScore(): Promise<string> {
    const receipt = await postRun();
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const wait =
      (reduced ? CLEAR_FINALE_REDUCED_MS : CLEAR_FINALE_MS) /
      Math.max(0.1, speed);
    window.setTimeout(() => {
      setLeg("done");
      setStatus(legPrompt("done"));
    }, wait);
    return receipt;
  }

  /** Start (or retry) the scored run from the orb's settled frame at
   *  centre: a quiet cycle like Check — the orb is already assembled,
   *  so it thinks from there instead of replaying the launch morph.
   *  When there is no waiting frame to pulse from (a failed clear
   *  finale leaves the orb answered), rekindle from a hard reset so
   *  Retry still works. */
  function startScore() {
    const quiet = askQuiet({
      text: pitchText,
      working: legWorkingMessage("run"),
      end: "clear",
      run: runScore,
      retry: startScore,
    });
    if (!quiet) {
      askLeg({
        text: pitchText,
        working: legWorkingMessage("run"),
        end: "clear",
        run: runScore,
        retry: startScore,
      });
    }
  }

  /** Score my idea: the run starts working on the press — the pool
   *  unmounts at once and the orb carries its thinking state down the
   *  glide to centre, so the descent is never idle. The parked advance
   *  only switches the leg on settle (see settleAdvance); a refused
   *  pulse is started there instead. */
  function requestScore() {
    if (pendingLeg.current !== null) return;
    pendingLeg.current = "run";
    setReturning(true);
    runPulseRef.current = askQuiet({
      text: pitchText,
      working: legWorkingMessage("run"),
      end: "clear",
      run: runScore,
      retry: startScore,
    });
  }

  /* ── local edits (no calls, no orb) ── */

  /** Any title edit re-scopes the last Check to the titles still in
   *  the box: kept verdicts stay green, added or reworded titles go
   *  plain until the next Check. Gifts clear — they belong to the
   *  checked set and rebuild from it. */
  function touchTitles(next: string) {
    const keys = new Set(parseSimilarTitles(next).map(titleVerdictKey));
    setCheckResult((prev) => {
      if (prev === null) return null;
      const resolved = prev.resolved.filter(
        (r) => typeof r.query === "string" && keys.has(titleVerdictKey(r.query)),
      );
      const notFound = prev.notFound.filter((n) => keys.has(titleVerdictKey(n)));
      return resolved.length === 0 && notFound.length === 0
        ? null
        : { resolved, notFound };
    });
    setTitleTags([]);
    setCutGifts([]);
    setShowCutGifts(false);
    setPreviewNote(null);
    setTitleTagsDone(false);
  }

  /** Back to the entry box: every leg's state clears and the page hands
   *  back to the landing entry (prefilled from the stored pitch). */
  function editPitch() {
    orbRef.current?.reset();
    setPitchText("");
    setTags([]);
    setSimilarTitles("");
    touchTitles("");
    setQlooSuggestions([]);
    setSuggestDone(false);
    setSteps([]);
    setResult(null);
    setError(null);
    setLeg("entry");
    setStatus(legPrompt("entry"));
    router.push(homeHref);
  }

  function addSuggested(title: string) {
    const clean = title.trim();
    if (clean === "") return;
    const have = new Set(
      parseSimilarTitles(similarTitles).map((s) => s.toLowerCase()),
    );
    if (have.has(clean.toLowerCase())) return;
    const next =
      similarTitles.trim() === ""
        ? clean
        : `${similarTitles.replace(/\s*,\s*$/, "")}, ${clean}`;
    touchTitles(next);
    setSimilarTitles(next);
  }

  function removeSimilar(title: string) {
    const keep = parseSimilarTitles(similarTitles).filter(
      (s) => s.toLowerCase() !== title.trim().toLowerCase(),
    );
    const next = keep.join(", ");
    touchTitles(next);
    setSimilarTitles(next);
  }

  function removeTitleTag(qlooId: string) {
    setTitleTags((prev) => prev.filter((t) => t.qlooId !== qlooId));
  }

  /** Put a cut taste back in the pool: it leaves the cut list and
   *  rejoins the title-gift chips (and so the gate). */
  function restoreGift(gift: TitleGift) {
    setTitleTags((prev) =>
      prev.some((t) => t.qlooId === gift.qlooId) ? prev : [...prev, gift],
    );
    setCutGifts((prev) => prev.filter((t) => t.qlooId !== gift.qlooId));
  }

  /** Park an input-leg advance: the old UI unmounts at once, the orb
   *  glides back to centre, and the host settles the parked leg once
   *  it lands. Refused while the orb is still working — a press never
   *  parks an advance mid-cycle. Status updates on settle, not before;
   *  the orb holds its thinking pose through the whole glide
   *  (beatWork), so the window between legs never reads as the
   *  waiting colour. */
  function requestAdvance(next: Leg) {
    if (working) return;
    pendingLeg.current = next;
    setReturning(true);
    setWorkLabel(SETUP_LINE);
    beatWork(SETUP_LINE);
  }

  /** Play the parked advance now that the orb is back at centre. The
   *  scored run normally already started on the press (requestScore)
   *  and stays centred — only a refused early pulse starts here. */
  function settleAdvance() {
    const next = pendingLeg.current;
    const runStarted = runPulseRef.current;
    pendingLeg.current = null;
    runPulseRef.current = false;
    setReturning(false);
    setWorkLabel(null);
    if (next === null) {
      beatSettle();
      return;
    }
    setLeg(next);
    setStatus(legPrompt(next));
    if (next === "run" && !runStarted) {
      startScore();
    } else {
      // Hands back to the waiting pose (a live run cycle refuses this
      // itself — it owns its own pose).
      beatSettle();
    }
  }

  function continueToTitles() {
    requestAdvance("titles");
  }

  function reviewFullSet() {
    if (checkBusy) return;
    if (checkResult === null || parsedSimilar.length === 0) return;
    requestAdvance("aggregate");
  }

  function armEntry(pitch: string) {
    setPitchText(pitch);
    beginLeg(legWorkingMessage("entry"));
    setRetry(() => askEntry(pitch));
  }

  return {
    ...sidecars,
    leg,
    returning,
    settleAdvance,
    status,
    error,
    interrupted,
    pitchText,
    workLabel,
    working,
    tags,
    similarTitles,
    similar: parsedSimilar,
    titleTags,
    titleTagsBusy,
    titleTagsDone,
    cutGifts,
    showCutGifts,
    previewNote,
    checkedCount: checkResult === null ? null : checkResult.resolved.length,
    checkBusy,
    checkError,
    checkResult,
    suggestions: qlooSuggestions,
    suggestBusy,
    suggestDone,
    steps,
    result,
    canContinue:
      matched + titleTags.length >= MIN_MATCHED_TAGS &&
      parsedSimilar.length >= 1,
    handlePhase,
    entrySubmit,
    armEntry,
    retry,
    setTags,
    onSimilarTitlesChange: (value: string) => {
      setSimilarTitles(value);
      touchTitles(value);
    },
    onAddSuggested: addSuggested,
    onRemoveSimilar: removeSimilar,
    onRemoveTitleTag: removeTitleTag,
    onToggleCutGifts: () => setShowCutGifts((v) => !v),
    onRestoreGift: restoreGift,
    onCheck: askCheck,
    onContinueToTitles: continueToTitles,
    onReviewFullSet: reviewFullSet,
    onRun: requestScore,
    onEditPitch: editPitch,
  };
}
