"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  clearLatestV2Id,
  latestV2Id,
  loadV2Result,
  saveV2Result,
} from "@/lib/demo/v2-store";
import { buildConfirmationInput } from "@/lib/pipeline/v2/confirmation";
import type { V2Input, V2Result } from "@/lib/pipeline/v2/types";
import { isLegacyV2Replay, parseV2Result, v2ReplayId } from "./v2-replay";
import { V2ResultView } from "./v2-result";
import { buildRevisionInput, LOST_RESPONSE_MESSAGE } from "./v2-result-utils";

type Status = "idle" | "pending" | "done" | "error";
const WORK_TYPES = ["film", "music", "book", "game"] as const;
const splitLines = (value: string) =>
  value
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

export function V2Analyze() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requestedRun = searchParams.get("run");
  const routeKey = `${pathname}?${searchParams.toString()}`;
  const ownRoute = useRef<string | null>(null);
  const request = useRef<AbortController | null>(null);
  const [pitchText, setPitchText] = useState("");
  const [workType, setWorkType] = useState<V2Input["workType"] | "">("");
  const [comparisons, setComparisons] = useState("");
  const [contrasts, setContrasts] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<V2Result | null>(null);
  const [restored, setRestored] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [correctionOf, setCorrectionOf] = useState<string | null>(null);

  function restoreInput(input: V2Input) {
    setPitchText(input.pitchText);
    setWorkType(input.workType);
    setComparisons((input.comparisons ?? []).join("\n"));
    setContrasts((input.contrasts ?? []).join("\n"));
    setCorrectionOf(input.correctionOf ?? null);
  }

  useEffect(() => {
    if (ownRoute.current === routeKey) return;
    request.current?.abort();
    request.current = null;
    setError("");
    setSaveError("");
    setResult(null);
    setRestored(false);
    setSaved(false);
    setStatus("idle");
    setPitchText("");
    setWorkType("");
    setComparisons("");
    setContrasts("");
    setCorrectionOf(null);
    if (requestedRun !== null) {
      const replay = loadV2Result(requestedRun);
      if (replay === null) {
        setError(
          "This saved version is missing, invalid, or browser storage is unavailable. No analysis was started. Open it in the browser where it was saved, or start a new analysis.",
        );
        return;
      }
      setResult(replay);
      setStatus("done");
      setRestored(true);
      setSaved(true);
      setSavedId(v2ReplayId(replay));
      return;
    }
    // Never silently restore an older save after a lost response or failed write.
    setSavedId(latestV2Id());
  }, [routeKey, requestedRun]);

  useEffect(
    () => () => {
      request.current?.abort();
    },
    [],
  );

  function setReplayUrl(id: string | null) {
    const url =
      id === null
        ? `${pathname}?new=1`
        : `${pathname}?run=${encodeURIComponent(id)}`;
    ownRoute.current = url;
    window.history.replaceState(null, "", url);
  }

  async function run(input: V2Input) {
    if (request.current !== null) return;
    const controller = new AbortController();
    request.current = controller;
    clearLatestV2Id();
    setReplayUrl(null);
    setStatus("pending");
    setResult(null);
    setSavedId(null);
    setError("");
    setSaveError("");
    setSaved(false);
    setRestored(false);
    restoreInput(input);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
        signal: controller.signal,
      });
      const data: unknown = await res.json().catch(() => null);
      if (controller.signal.aborted) return;
      if (!res.ok) {
        const message =
          typeof data === "object" &&
          data !== null &&
          "error" in data &&
          typeof data.error === "string"
            ? data.error
            : "Analysis failed.";
        setError(
          `${message} A result was not received; server-side usage may already have occurred. Retrying may spend another analysis.`,
        );
        setStatus("error");
        return;
      }
      const next = parseV2Result(data);
      if (next === null || isLegacyV2Replay(next)) {
        setError(
          `The server returned an invalid or outdated result; it was not displayed or saved. ${LOST_RESPONSE_MESSAGE}`,
        );
        setStatus("error");
        return;
      }
      setResult(next);
      setCorrectionOf(v2ReplayId(next));
      const durable = saveV2Result(next);
      setSaved(durable);
      setSavedId(durable ? v2ReplayId(next) : null);
      if (durable) setReplayUrl(v2ReplayId(next));
      else
        setSaveError(
          "This result could not be saved in browser storage. It is visible in this tab only; reload or leaving the page may lose it. Enable browser storage or free space, then retry saving without re-running the analysis.",
        );
      setStatus("done");
    } catch {
      if (!controller.signal.aborted) {
        setError(LOST_RESPONSE_MESSAGE);
        setStatus("error");
      }
    } finally {
      if (request.current === controller) request.current = null;
    }
  }

  function startNew() {
    setReplayUrl(null);
    setResult(null);
    setStatus("idle");
    setError("");
    setSaveError("");
    setRestored(false);
    setSaved(false);
    setPitchText("");
    setWorkType("");
    setComparisons("");
    setContrasts("");
    setCorrectionOf(null);
  }

  return (
    <div className="flex w-full max-w-[720px] flex-col">
      {error !== "" && (
        <p className="mb-4 text-sm text-ink" role="alert">
          {error}
        </p>
      )}
      {saveError !== "" && (
        <div
          className="mb-4 border border-rule p-4 text-sm text-ink-2"
          role="alert"
        >
          <p>{saveError}</p>
          {result !== null && (
            <button
              type="button"
              className="mt-2 underline"
              onClick={() => {
                if (saveV2Result(result)) {
                  setSaved(true);
                  setSavedId(v2ReplayId(result));
                  setSaveError("");
                  setReplayUrl(v2ReplayId(result));
                }
              }}
            >
              Retry saving — no new analysis
            </button>
          )}
        </div>
      )}
      {result === null || status === "pending" ? (
        <form
          aria-busy={status === "pending"}
          onSubmit={(e) => {
            e.preventDefault();
            if (workType === "") return;
            void run({
              pitchText,
              workType,
              comparisons: splitLines(comparisons),
              contrasts: splitLines(contrasts),
              correctionOf,
            });
          }}
          className="flex flex-col gap-4"
        >
          <fieldset
            disabled={status === "pending"}
            className="flex min-w-0 flex-col gap-4"
          >
            <label className="flex flex-col gap-2">
              <span className="font-serif text-lg text-ink">Your idea</span>
              <textarea
                value={pitchText}
                onChange={(e) => setPitchText(e.target.value)}
                rows={6}
                required
                placeholder="A quiet science-fiction film about a lonely worker on a space station."
                className="border border-rule bg-surface p-4 text-body text-ink"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-ink-2">
              Type
              <select
                value={workType}
                onChange={(e) => {
                  const selected = WORK_TYPES.find(
                    (type) => type === e.target.value,
                  );
                  setWorkType(selected ?? "");
                }}
                required
                className="border border-rule bg-surface px-2 py-1 text-base"
              >
                <option value="" disabled>
                  Choose type
                </option>
                {WORK_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
            <details className="text-sm text-ink-2">
              <summary className="cursor-pointer">
                Optional context (comparisons, contrasts)
              </summary>
              <div className="mt-2 flex flex-col gap-2">
                <label className="flex flex-col gap-1">
                  Similar to (one per line; up to two retrieved)
                  <textarea
                    value={comparisons}
                    onChange={(e) => setComparisons(e.target.value)}
                    rows={2}
                    className="border border-rule bg-surface p-2 text-base"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  Nothing like it (one per line; up to five)
                  <textarea
                    value={contrasts}
                    onChange={(e) => setContrasts(e.target.value)}
                    rows={2}
                    className="border border-rule bg-surface p-2 text-base"
                  />
                </label>
              </div>
            </details>
            <button
              type="submit"
              disabled={
                status === "pending" ||
                pitchText.trim() === "" ||
                workType === ""
              }
              className="border border-ink bg-ink px-4 py-2 text-sm text-surface disabled:opacity-40"
            >
              {status === "pending" ? "Analyzing…" : "Find audiences"}
            </button>
          </fieldset>
          {status === "pending" && (
            <output className="block text-sm text-ink-2">
              Analysis requested — waiting for the server result. This can take
              up to about 90 seconds.
            </output>
          )}
          {status !== "pending" && savedId !== null && (
            <Link
              href={`/analyze?run=${encodeURIComponent(savedId)}`}
              className="self-start text-sm text-ink-3 underline"
            >
              Open last saved version (not necessarily your latest analysis)
            </Link>
          )}
        </form>
      ) : (
        <>
          <button
            type="button"
            onClick={startNew}
            className="self-start font-mono text-xs text-ink-3 underline"
          >
            Start a fresh analysis
          </button>
          {saved && savedId !== null && (
            <output className="mt-3 block text-sm text-ink-3">
              Saved in this browser.{" "}
              <Link
                href={`/analyze?run=${encodeURIComponent(savedId)}`}
                className="underline"
              >
                Reopen this version
              </Link>{" "}
              without a new analysis; this link is not a server-hosted share.
            </output>
          )}
          <V2ResultView
            key={v2ReplayId(result) ?? "result"}
            result={result}
            restored={restored}
            onConfirm={(aspectIds) => {
              try {
                void run(buildConfirmationInput(result, aspectIds));
              } catch {
                setError(
                  "This saved interpretation cannot safely be confirmed. Start a fresh analysis instead; no new analysis was sent.",
                );
              }
            }}
            onRevise={() => {
              restoreInput(buildRevisionInput(result));
              setReplayUrl(null);
              setResult(null);
              setStatus("idle");
              setError("");
              setSaveError("");
              setSaved(false);
              setRestored(false);
            }}
          />
        </>
      )}
    </div>
  );
}
