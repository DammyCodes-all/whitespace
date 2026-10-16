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
import { type RefObject, useState } from "react";
import type { CheckResult, Leg, TitleGift } from "@/components/orb/types";
import { useOrbBridge } from "@/components/orb/use-orb-bridge";
import {
  type ResultSidecars,
  useResultSidecars,
} from "@/components/orb/use-result-sidecars";
import type {
  OrbHandle,
  OrbPhase,
} from "@/components/ui/ai-thinking-orb-and-input";
import { MIN_MATCHED_TAGS } from "@/lib/config";
import type { FlowResult, FlowTag } from "@/lib/flow/contract";
import { parseSimilarTitles } from "@/lib/flow/similar-titles";
import type { FlowStepRow } from "@/lib/flow/view-types";
import {
  legPrompt,
  legWorkingMessage,
  receiptLine,
  runReceipt,
} from "@/lib/orb/orb-status";
import type { WorkType } from "@/lib/types";

export interface OrbRun extends ResultSidecars {
  /** Which leg the run is on. */
  leg: Leg;
  /** The one honest line under the orb — errors and interruption only. */
  status: string;
  error: string | null;
  interrupted: boolean;
  pitchText: string;
  /** Honest line for the orb's think phase — the work in flight. */
  workLabel: string | null;

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
}: {
  orbRef: RefObject<OrbHandle | null>;
  /** Where Edit-the-pitch hands back to (the entry that started this). */
  homeHref: string;
}): OrbRun {
  const router = useTransitionRouter();
  const [leg, setLeg] = useState<Leg>("entry");
  const {
    status,
    error,
    interrupted,
    workLabel,
    setStatus,
    setError,
    beginLeg,
    askLeg,
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

  async function postCheck(): Promise<string> {
    const list = parseSimilarTitles(similarTitles);
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
        throw new Error("check-failed");
      }
      const resolved = Array.isArray(data.resolved) ? data.resolved : [];
      const notFound = Array.isArray(data.notFound) ? data.notFound : [];
      setCheckResult({ resolved, notFound });
      setTitleTags([]);
      setCutGifts([]);
      setShowCutGifts(false);
      setPreviewNote(null);
      setTitleTagsDone(false);
      setQlooSuggestions([]);
      setSuggestDone(false);
      const names = resolved
        .map((r) => r.name)
        .filter((n): n is string => typeof n === "string" && n.trim() !== "");
      if (names.length > 0) {
        void fetchTitleTags(names, workType);
        void fetchTitleSuggestions(
          resolved
            .map((r) => r.qlooId)
            .filter(
              (id): id is string => typeof id === "string" && id.trim() !== "",
            ),
          parseSimilarTitles(similarTitles),
          workType,
        );
      } else {
        setTitleTagsDone(true);
        setSuggestDone(true);
      }
      const line = receiptLine("titles", resolved.length, notFound.length);
      setStatus(`${line} Tap suggestions to add, Done when set.`);
      return `${line} Done when set.`;
    } catch (e) {
      if (e instanceof Error && e.message === "check-failed") throw e;
      setCheckError("Could not reach the title check.");
      setCheckResult(null);
      throw new Error("check-failed");
    }
  }

  function askCheck() {
    const list = parseSimilarTitles(similarTitles);
    if (list.length === 0 || checkBusy) return;
    setCheckBusy(true);
    askLeg({
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

  function askRun() {
    askLeg({
      text: pitchText,
      working: legWorkingMessage("run"),
      end: "clear",
      run: async () => {
        const receipt = await postRun();
        setLeg("done");
        setStatus(legPrompt("done"));
        return receipt;
      },
      retry: askRun,
    });
  }

  /* ── local edits (no calls, no orb) ── */

  /** Any title edit invalidates the last Check — its tags, gifts,
   *  suggestions and gift verdict all come from the checked set. */
  function touchTitles() {
    setCheckResult(null);
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
    touchTitles();
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
    touchTitles();
    setSimilarTitles((prev) =>
      prev.trim() === "" ? clean : `${prev.replace(/\s*,\s*$/, "")}, ${clean}`,
    );
  }

  function removeSimilar(title: string) {
    const keep = parseSimilarTitles(similarTitles).filter(
      (s) => s.toLowerCase() !== title.trim().toLowerCase(),
    );
    touchTitles();
    setSimilarTitles(keep.join(", "));
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

  function continueToTitles() {
    setLeg("titles");
    setStatus(legPrompt("titles"));
  }

  function reviewFullSet() {
    if (checkResult === null || parsedSimilar.length === 0) return;
    setLeg("aggregate");
    setStatus(legPrompt("aggregate"));
  }

  function armEntry(pitch: string) {
    setPitchText(pitch);
    beginLeg(legWorkingMessage("entry"));
    setRetry(() => askEntry(pitch));
  }

  return {
    ...sidecars,
    leg,
    status,
    error,
    interrupted,
    pitchText,
    workLabel,
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
      touchTitles();
    },
    onAddSuggested: addSuggested,
    onRemoveSimilar: removeSimilar,
    onRemoveTitleTag: removeTitleTag,
    onToggleCutGifts: () => setShowCutGifts((v) => !v),
    onRestoreGift: restoreGift,
    onCheck: askCheck,
    onContinueToTitles: continueToTitles,
    onReviewFullSet: reviewFullSet,
    onRun: askRun,
    onEditPitch: editPitch,
  };
}
