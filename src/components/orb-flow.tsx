"use client";

/**
 * The run. One blank stage from pitch to verdict: a flat orb pulses
 * while each leg works and stills when its receipt lands, with one
 * honest line beneath it — tags, similar titles, the aggregated set,
 * then the scored run. Entry lives on the landing page; ?pitch=
 * autostarts the first leg on mount. Backend calls are the same routes
 * the stepped flow uses; only the presentation changed.
 *
 * Spec ref: §5 (the run reports itself as it goes).
 */

import { useSearchParams } from "next/navigation";
import { useTransitionRouter } from "next-view-transitions";
import { useEffect, useRef, useState } from "react";
import { ChangeView } from "@/components/change";
import type { ChatbotView } from "@/components/chatbot-preview";
import {
  clearFlight,
  type FlightRect,
  peekFlight,
} from "@/components/entry-box";
import { FlowCompareView } from "@/components/flow-compare";
import { GapsCard } from "@/components/flow-gaps";
import { FlowResultView } from "@/components/flow-result-view";
import { TagChips } from "@/components/tag-chips";
import MorphOrb, {
  type OrbEnd,
  type OrbHandle,
  type OrbPhase,
} from "@/components/ui/ai-thinking-orb-and-input";
import { MIN_MATCHED_TAGS } from "@/lib/config";
import type { FlowEvidence, FlowResult } from "@/lib/flow/contract";
import { parseSimilarTitles } from "@/lib/flow/similar-titles";
import type { FlowStepRow } from "@/lib/flow/view-types";
import {
  legPrompt,
  legWorkingMessage,
  type OrbLeg,
  receiptLine,
  runReceipt,
} from "@/lib/orb/orb-status";
import type { ChangedRun } from "@/lib/pipeline/change";
import type { QlooCall, WorkType } from "@/lib/types";

type Leg = OrbLeg;

interface TitleGift {
  qlooId: string;
  label: string;
  sourceTitleId: string | null;
  sourceTitleName: string | null;
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

export function OrbFlow({ homeHref = "/" }: { homeHref?: string }) {
  const params = useSearchParams();
  const router = useTransitionRouter();
  const [leg, setLeg] = useState<Leg>("entry");
  const [status, setStatus] = useState(legPrompt("entry"));
  const [error, setError] = useState<string | null>(null);
  const [interrupted, setInterrupted] = useState(false);
  const [pitchText, setPitchText] = useState("");
  const [workType, setWorkType] = useState<WorkType>("film");
  const [tags, setTags] = useState<FlowResult["tags"]>([]);
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
  const [checkResult, setCheckResult] = useState<{
    resolved: { query: string; name: string; qlooId: string }[];
    notFound: string[];
  } | null>(null);
  const [steps, setSteps] = useState<FlowStepRow[]>([]);
  const [result, setResult] = useState<FlowResult | null>(null);
  const [chatbot, setChatbot] = useState<ChatbotView | null>(null);
  const [chatbotError, setChatbotError] = useState<string | null>(null);
  const [compareCalls, setCompareCalls] = useState<QlooCall[]>([]);
  const [compareLoaded, setCompareLoaded] = useState(false);
  const [constraint, setConstraint] = useState("");
  const [changed, setChanged] = useState<ChangedRun | null>(null);
  const [changeBusy, setChangeBusy] = useState(false);
  const [changeError, setChangeError] = useState<string | null>(null);
  /** Honest line for the orb's think phase — the work in flight. */
  const [workLabel, setWorkLabel] = useState<string | null>(null);

  const orbRef = useRef<OrbHandle | null>(null);
  /** Hand-rolled morph flight: the landing box flies here as a clone
   *  and lands on the idle pill before the runtime morph begins. */
  const [flight, setFlight] = useState<{
    rect: FlightRect;
    pitch: string;
  } | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const cloneRef = useRef<HTMLDivElement>(null);
  const cloneTextRef = useRef<HTMLParagraphElement>(null);
  const flightAnim = useRef<Animation | null>(null);
  const scheduledRef = useRef(false);
  /** True while a leg's request is in flight (receipt not yet landed). */
  const pendingRef = useRef(false);
  const askAtRef = useRef(0);
  const legOkRef = useRef(false);
  const retryRef = useRef<() => void>(() => {});
  const autoStarted = useRef(false);

  const matched = tags.filter((t) => t.status === "matched").length;
  const parsedSimilar = parseSimilarTitles(similarTitles);

  /** Plain fetch, no client timeout — Qloo slowness resolves as data
   *  or a real error, never a client abort. */
  async function chipFetch(url: string, init: RequestInit): Promise<Response> {
    return fetch(url, init);
  }

  function beginLeg(working: string) {
    pendingRef.current = true;
    askAtRef.current = Date.now();
    legOkRef.current = false;
    setError(null);
    setInterrupted(false);
    setStatus(working);
    setWorkLabel(working);
  }

  /** One orb cycle around caller work. Legs end quietly — no receipt
   *  cards: "wait" holds the orb with a nudge while the leg's UI
   *  below takes the input; "clear" (the scored run) flashes green
   *  and dissolves so the result takes over. Legs advance inline
   *  when their response lands (never gated on the animation — a dead
   *  runtime must not strand the flow). */
  function askLeg(opts: {
    text: string;
    working: string;
    end: OrbEnd;
    run: () => Promise<string>;
    retry: () => void;
  }) {
    beginLeg(opts.working);
    retryRef.current = opts.retry;
    const run = opts.run;
    orbRef.current?.ask(
      opts.text,
      async () => {
        try {
          const receipt = await run();
          legOkRef.current = true;
          pendingRef.current = false;
          return receipt;
        } catch {
          legOkRef.current = false;
          pendingRef.current = false;
          return "That step failed — retry below.";
        }
      },
      opts.end,
    );
  }

  /** The orb fires answered once a leg's receipt lands (never gated on
   *  animation — a dead orb must not strand the flow). Esc mid-leg drops
   *  through idle/reset inside 800ms of our own ask, so only a later
   *  idle/reset counts as an interruption. */
  function handlePhase(p: OrbPhase) {
    if (
      (p === "idle" || p === "reset") &&
      pendingRef.current &&
      Date.now() - askAtRef.current > 800
    ) {
      pendingRef.current = false;
      setInterrupted(true);
      setStatus("Interrupted — nothing was spent. Retry the step when ready.");
      return;
    }
    if (p !== "answered" || pendingRef.current) return;
    if (!legOkRef.current) {
      setStatus("That step failed. Retry below — nothing was spent.");
    }
  }

  /* ── leg work: the same routes the stepped flow uses ── */

  async function postTags(pitch: string): Promise<string> {
    const res = await fetch("/api/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pitchText: pitch }),
    });
    const data = (await res.json()) as {
      tags?: FlowResult["tags"];
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
    retryRef.current = () => askEntry(trimmed);
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
    setChatbot(null);
    setChatbotError(null);
    setCompareCalls([]);
    setCompareLoaded(false);
    setChanged(null);
    setChangeError(null);
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

  /* ── compare sidecar + change (same as the stepped flow) ── */

  const compareForResult = useRef<FlowResult | null>(null);
  useEffect(() => {
    if (leg !== "done" || result === null) return;
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
        const data = (await res.json()) as {
          chatbot: ChatbotView | null;
          error: string | null;
          calls: QlooCall[];
        };
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
  }, [leg, result]);

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
      const data = (await res.json()) as {
        changed?: ChangedRun;
        error?: string;
      };
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

  // Shared-link entry: ?pitch= autostarts, mount-only. Guarded for
  // StrictMode's double effect so one pitch spends one tag call, never
  // two. The morph lives inside the move: the entry navigates at once,
  // and here a twin clone flies from the stored box rect while
  // reshaping card → ink ball in one 650ms move — then the runtime
  // joins at the ball and grows to the orb (no replay, no pause).
  // biome-ignore lint/correctness/useExhaustiveDependencies: mount-only auto-start
  useEffect(() => {
    if (autoStarted.current || scheduledRef.current) return;
    const shared = (params.get("pitch") ?? "").slice(0, 2000).trim();
    if (shared === "") return;
    scheduledRef.current = true;
    // Arm the entry leg before the runtime reaches its think phase: the
    // orb reads the work line once, at think start — without this the
    // first (autostarted) leg plays the generic label cycle.
    setPitchText(shared);
    beginLeg(legWorkingMessage("entry"));
    retryRef.current = () => askEntry(shared);
    const startNow = () => {
      autoStarted.current = true;
      orbRef.current?.setText(shared);
      orbRef.current?.submit(shared, "wait");
    };
    const startFromBall = () => {
      autoStarted.current = true;
      orbRef.current?.setText(shared);
      orbRef.current?.submitFromBall(shared, "wait");
    };
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const rect = reduced ? null : peekFlight();
    if (rect === null) {
      startNow();
      return;
    }
    setFlight({ rect, pitch: shared });
    const box: FlightRect = rect;
    // Let the page crossfade get going first so the flight isn't
    // buried under the outgoing snapshot — then fly + morph live.
    let timer = 0;
    const raf = window.requestAnimationFrame(() => {
      timer = window.setTimeout(() => {
        startFlight();
      }, 120);
    });
    function startFlight() {
      const target = pillTarget();
      const clone = cloneRef.current;
      if (target === null || clone === null) {
        setFlight(null);
        clearFlight();
        startNow();
        return;
      }
      // Ball handoff (the entry morphed in place before navigating):
      // the clone is already a 60px ink ball — fly it to the pill
      // centre, then join the runtime at the ball. Legacy card rects
      // (no shape, 30s window) keep the old in-flight morph.
      if (box.shape === "ball") {
        const dest = {
          left: target.left + target.width / 2 - 30,
          top: target.top + target.height / 2 - 30,
        };
        const anim = clone.animate(
          [
            { left: `${box.left}px`, top: `${box.top}px` },
            { left: `${dest.left}px`, top: `${dest.top}px` },
          ],
          {
            duration: 450,
            easing: "cubic-bezier(0.65, 0, 0.35, 1)",
            fill: "forwards",
          },
        );
        flightAnim.current = anim;
        anim.onfinish = () => {
          flightAnim.current = null;
          startFromBall();
          // Crossfade into the runtime ball (it fades in underneath
          // over ~120ms): the clone fades out instead of cutting.
          const hide = () => {
            setFlight(null);
            clearFlight();
          };
          try {
            const fade = clone.animate([{ opacity: "1" }, { opacity: "0" }], {
              duration: 160,
              easing: "ease-out",
              fill: "forwards",
            });
            if (typeof fade.finished === "object" && fade.finished !== null) {
              fade.finished.then(hide, hide);
            } else {
              window.setTimeout(hide, 170);
            }
          } catch {
            hide();
          }
        };
        return;
      }
      // Twin of the entry card → ink ball at the pill centre.
      const ball = {
        left: target.left + target.width / 2 - 30,
        top: target.top + target.height / 2 - 30,
      };
      const anim = clone.animate(
        [
          {
            left: `${box.left}px`,
            top: `${box.top}px`,
            width: `${box.width}px`,
            height: `${box.height}px`,
            borderRadius: "16px",
            backgroundColor: "#ffffff",
            boxShadow: "4px 4px 0 #17151f",
          },
          {
            left: `${target.left}px`,
            top: `${target.top}px`,
            width: `${target.width}px`,
            height: `${target.height}px`,
            borderRadius: "16px",
            backgroundColor: "#ffffff",
            boxShadow: "4px 4px 0 #17151f",
            offset: 0.6,
          },
          {
            left: `${ball.left}px`,
            top: `${ball.top}px`,
            width: "60px",
            height: "60px",
            borderRadius: "30px",
            backgroundColor: "#17151f",
            boxShadow: "0px 0px 0 rgba(23,21,31,0)",
          },
        ],
        {
          duration: 650,
          easing: "cubic-bezier(0.65, 0, 0.35, 1)",
          fill: "forwards",
        },
      );
      // Input melt: the pitch text blurs + drops out fast in the
      // opening beat (the original's inScale melt), while the box
      // keeps flying + reshaping behind it.
      cloneTextRef.current?.animate(
        [
          { opacity: "1", filter: "blur(0px)" },
          { opacity: "0", filter: "blur(12px)" },
        ],
        { duration: 200, easing: "ease-out", fill: "forwards" },
      );
      flightAnim.current = anim;
      anim.onfinish = () => {
        flightAnim.current = null;
        startFromBall();
        // Same crossfade as the ball path: clone out, runtime in.
        const hide = () => {
          setFlight(null);
          clearFlight();
        };
        try {
          const fade = clone.animate([{ opacity: "1" }, { opacity: "0" }], {
            duration: 160,
            easing: "ease-out",
            fill: "forwards",
          });
          if (typeof fade.finished === "object" && fade.finished !== null) {
            fade.finished.then(hide, hide);
          } else {
            window.setTimeout(hide, 170);
          }
        } catch {
          hide();
        }
      };
    }
    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(timer);
      flightAnim.current?.cancel();
      flightAnim.current = null;
      scheduledRef.current = false;
    };
  }, []);

  /** Where the idle pill sits in viewport coords: stage centre-x,
   *  mover anchor (40px) plus the 80px flight offset, pill 200px tall. */
  function pillTarget(): FlightRect | null {
    const stage = stageRef.current;
    if (stage === null) return null;
    const r = stage.getBoundingClientRect();
    if (r.width <= 0) return null;
    const w = Math.max(280, Math.min(720, r.width - 32));
    const h = 200;
    return {
      left: r.left + r.width / 2 - w / 2,
      top: r.top + 120 - h / 2,
      width: w,
      height: h,
    };
  }

  const canContinue =
    matched + titleTags.length >= MIN_MATCHED_TAGS && parsedSimilar.length >= 1;

  return (
    <div
      className={`mx-auto w-full max-w-5xl px-6 pt-6 sm:px-8 ${leg === "entry" ? "" : "pb-12"}`}
    >
      <div className="flex min-h-[240px] flex-col justify-center">
        <div ref={stageRef}>
          <MorphOrb
            orbRef={orbRef}
            onPhaseChange={handlePhase}
            onSubmit={entrySubmit}
            minThinkMs={1500}
            workingLabel={workLabel ?? undefined}
          />
        </div>
      </div>
      {flight !== null && (
        <div
          ref={cloneRef}
          aria-hidden="true"
          className={
            flight.rect.shape === "ball"
              ? "flight-clone flight-ball"
              : "flight-clone"
          }
          style={{
            left: flight.rect.left,
            top: flight.rect.top,
            width: flight.rect.width,
            height: flight.rect.height,
          }}
        >
          {flight.rect.shape === "ball" ? null : (
            <p ref={cloneTextRef} className="flight-text">
              {flight.pitch}
            </p>
          )}
        </div>
      )}

      {/* Errors only — the work line lives under the orb, and leg
          instructions live with the leg's own UI below. */}
      {(error !== null || interrupted) && (
        <output
          aria-live="polite"
          className="mx-auto mt-2 block max-w-prose text-center text-sm leading-relaxed text-ink-2"
        >
          {error ?? status}
        </output>
      )}
      {error !== null && (
        <p role="alert" className="mt-2 text-center text-sm text-ink-2">
          {error}
        </p>
      )}
      {(error !== null || interrupted) && (
        <div className="mt-3 flex justify-center">
          <button
            type="button"
            onClick={() => retryRef.current()}
            className="btn-secondary px-5 py-2 text-sm"
          >
            Retry this step
          </button>
        </div>
      )}

      {(leg === "tags" || leg === "titles" || leg === "aggregate") && (
        <section
          aria-label="Tags under review"
          className="mx-auto mt-4 max-w-3xl"
        >
          <TagChips
            tags={tags}
            onChange={setTags}
            loading={false}
            extraMatched={titleTags.length}
            extraChips={titleTags.map((t) => ({
              key: t.qlooId,
              label: t.label,
              badge: t.sourceTitleName ?? "title",
              onRemove: () => removeTitleTag(t.qlooId),
            }))}
          />
          {titleTagsBusy && (
            <p className="mt-3 font-mono text-xs text-ink-3">
              Reading the titles' tags…
            </p>
          )}
          {!titleTagsBusy &&
            titleTagsDone &&
            checkResult !== null &&
            checkResult.resolved.length > 0 &&
            titleTags.length === 0 &&
            cutGifts.length === 0 && (
              <p className="mt-4 max-w-prose text-body text-ink-2">
                {previewNote === "no-tastes" &&
                  "Qloo has no taste data for these titles. Only your pitch words will score."}
                {previewNote === "all-generic" &&
                  "These titles' top tastes were all generic (half the controls hold them too). Only your sharper pitch words will score."}
                {previewNote === "preview-failed" &&
                  "Couldn't read the titles' tastes. Only pitch words will score. Check again to retry."}
                {(previewNote === null ||
                  previewNote === "ok" ||
                  previewNote === "unresolved") &&
                  "The checked titles added no tags. Only pitch words will score; the run still needs one similar title."}
              </p>
            )}
          {!titleTagsBusy && titleTagsDone && cutGifts.length > 0 && (
            <div className="mt-4">
              <p className="max-w-prose text-body text-ink-2">
                We cut{" "}
                {cutGifts.length === 1 ? "one tag" : `${cutGifts.length} tags`}{" "}
                that didn&apos;t seem to fit your pitch. Put back any that
                should count.
              </p>
              <button
                type="button"
                onClick={() => setShowCutGifts((v) => !v)}
                className="btn-secondary mt-2 px-4 py-2 text-sm"
              >
                {showCutGifts ? "Hide cut tags" : "Show cut tags"}
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
        </section>
      )}

      {leg === "tags" && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => {
              setLeg("titles");
              setStatus(legPrompt("titles"));
            }}
            className="btn-primary px-6 py-3 text-sm"
          >
            These look right, continue
          </button>
          <button
            type="button"
            onClick={editPitch}
            className="btn-secondary px-5 py-3 text-sm"
          >
            Edit the pitch
          </button>
        </div>
      )}

      {(leg === "titles" || leg === "aggregate") && (
        <section
          aria-label="Similar-to titles"
          className="mx-auto mt-4 max-w-3xl"
        >
          <h2 className="text-lg tracking-tight text-ink">Similar-to titles</h2>
          <p className="mt-1 max-w-prose text-body text-ink-2">
            Put your idea next to a few titles it sits beside. Qloo reads what
            those audiences already like and adds those tastes to your tags, and
            the tags are what the score runs on. One title is enough to start.
          </p>
          <label
            htmlFor="orb-similar"
            className="mt-3 block font-mono text-xs text-ink-3"
          >
            Separate with commas
          </label>
          <div className="mt-1 flex flex-col gap-2 sm:flex-row">
            <input
              id="orb-similar"
              value={similarTitles}
              onChange={(e) => {
                setSimilarTitles(e.target.value);
                touchTitles();
              }}
              placeholder="Moon, Arrival"
              className="min-w-0 flex-1 border-2 border-outline bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-3"
            />
            <button
              type="button"
              onClick={askCheck}
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
                Titles changed. Check again to refresh the tags and suggestions.
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
                <ul aria-label="Found in Qloo" className="flex flex-wrap gap-2">
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
          {suggestBusy ? (
            <p className="mt-6 font-mono text-xs text-ink-3">
              Finding titles like yours…
            </p>
          ) : qlooSuggestions.length > 0 ? (
            <section aria-label="Similar to your idea" className="mt-6">
              <h2 className="text-lg tracking-tight text-ink">
                Similar to your idea?
              </h2>
              <p className="mt-1 max-w-prose text-body text-ink-2">
                From the taste database: titles related to the ones you typed.
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
                Nothing related this time. Type your own titles above; Check
                verifies each.
              </p>
            )
          )}
        </section>
      )}

      {leg === "titles" && (
        <div className="mt-6 flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (checkResult === null || parsedSimilar.length === 0) return;
              setLeg("aggregate");
              setStatus(legPrompt("aggregate"));
            }}
            disabled={checkResult === null || parsedSimilar.length === 0}
            className="btn-primary px-6 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            Review the full tag set
          </button>
          {checkResult === null && (
            <p className="font-mono text-xs text-clay">
              Check the titles first. Suggestions only come from verified ones.
            </p>
          )}
        </div>
      )}

      {leg === "aggregate" && (
        <div className="mt-6 flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={askRun}
            disabled={!canContinue}
            className="btn-primary px-6 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            Score my idea
          </button>
          {!canContinue && (
            <p className="font-mono text-xs text-clay">
              {parsedSimilar.length < 1
                ? "Add at least one similar title. Your tags get built from it."
                : `${MIN_MATCHED_TAGS} tags minimum. Add sharper words or titles.`}
            </p>
          )}
        </div>
      )}

      {leg === "done" && result !== null && (
        <section aria-label="Results" className="mt-10">
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

          <div className="mt-8">
            <FlowResultView result={result} orangeVerdict={result.surprise} />
          </div>

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
                    htmlFor="orb-constraint"
                    className="block font-mono text-xs text-ink-3"
                  >
                    Limit (for example a smaller budget)
                  </label>
                  <div className="mt-1 flex flex-col gap-2 sm:flex-row">
                    <input
                      id="orb-constraint"
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
            <p className="mt-12 font-mono text-xs text-ink-3">
              Checking the plain chatbot…
            </p>
          )}

          <div className="mt-10">
            <details>
              <summary className="cursor-pointer text-base tracking-tight text-ink">
                Evidence ·{" "}
                {result.qlooCalls.total +
                  compareCalls.length +
                  (changed?.calls.length ?? 0)}{" "}
                calls
              </summary>
              {steps.length > 0 && (
                <details className="mt-3">
                  <summary className="cursor-pointer font-mono text-xs text-ink-3">
                    Run steps · {steps.length}
                  </summary>
                  <ul className="mt-1 space-y-1">
                    {steps.map((step) => (
                      <li
                        key={step.id}
                        className="text-sm leading-relaxed text-ink-2"
                      >
                        {step.label} — {step.detail ?? "done"}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
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
            </details>
          </div>
        </section>
      )}
    </div>
  );
}
