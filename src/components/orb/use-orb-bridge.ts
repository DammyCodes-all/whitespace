"use client";

/**
 * One orb cycle around caller work: the one honest line under the orb
 * (errors and interruption only), the work line the runtime reads, and
 * the retry the failure paths share.
 *
 * Legs end quietly — no receipt cards: "wait" holds the orb with a nudge
 * while the leg's UI below takes the input; "clear" (the scored run)
 * flashes green and dissolves so the result takes over. Legs advance
 * inline when their response lands (never gated on the animation — a
 * dead runtime must not strand the flow).
 *
 * Spec ref: §5 (the run reports itself as it goes).
 */

import { type RefObject, useRef, useState } from "react";
import type {
  OrbEnd,
  OrbHandle,
  OrbPhase,
} from "@/components/ui/ai-thinking-orb-and-input";
import { legPrompt } from "@/lib/orb/orb-status";

export interface OrbBridge {
  status: string;
  error: string | null;
  interrupted: boolean;
  /** Honest line for the orb's think phase — the work in flight. */
  workLabel: string | null;
  /** Override the orb's work line (e.g. a between-leg beat). */
  setWorkLabel: (line: string | null) => void;
  setStatus: (line: string) => void;
  setError: (line: string | null) => void;
  /** Arm a leg: clear the last outcome, show the work line. */
  beginLeg: (working: string) => void;
  askLeg: (opts: {
    text: string;
    working: string;
    end: OrbEnd;
    run: () => Promise<string>;
    retry: () => void;
  }) => void;
  /** Think-only cycle around caller work: same bookkeeping as askLeg
   *  but the orb never leaves its frame (no box morph). For mid-leg
   *  refreshes like Check. Returns false when the orb refused. */
  askQuiet: (opts: {
    text: string;
    working: string;
    end: OrbEnd;
    run: () => Promise<string>;
    retry: () => void;
  }) => boolean;
  /** Between-leg advance beat: no cycle runs while the orb glides down
   *  and back, but the orb holds its thinking pose for the whole window
   *  (`line` is the honest line for it). */
  beatWork: (line: string) => void;
  /** The beat is over: hand the orb back to the waiting pose. */
  beatSettle: () => void;
  handlePhase: (p: OrbPhase) => void;
  /** Point the shared Retry at a leg the caller is driving itself. */
  setRetry: (fn: () => void) => void;
  /** Re-run the leg that last failed or was interrupted. */
  retry: () => void;
}

export function useOrbBridge(orbRef: RefObject<OrbHandle | null>): OrbBridge {
  const [status, setStatus] = useState(legPrompt("entry"));
  const [error, setError] = useState<string | null>(null);
  const [interrupted, setInterrupted] = useState(false);
  const [workLabel, setWorkLabel] = useState<string | null>(null);

  /** True while a leg's request is in flight (receipt not yet landed). */
  const pendingRef = useRef(false);
  const askAtRef = useRef(0);
  const legOkRef = useRef(false);
  const retryRef = useRef<() => void>(() => {});

  function beginLeg(working: string) {
    pendingRef.current = true;
    askAtRef.current = Date.now();
    legOkRef.current = false;
    setError(null);
    setInterrupted(false);
    setStatus(working);
    setWorkLabel(working);
  }

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

  function askQuiet(opts: {
    text: string;
    working: string;
    end: OrbEnd;
    run: () => Promise<string>;
    retry: () => void;
  }): boolean {
    beginLeg(opts.working);
    retryRef.current = opts.retry;
    const run = opts.run;
    const started = orbRef.current?.pulse(
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
    if (started !== true) {
      // Orb mid-cycle (never the waiting orb): unwind so the caller
      // can release its own busy state and the step stays retryable.
      pendingRef.current = false;
      setStatus("The orb is busy — retry this step.");
    }
    return started === true;
  }

  function beatWork(line: string) {
    orbRef.current?.beat(true, line);
  }

  function beatSettle() {
    orbRef.current?.beat(false);
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

  return {
    status,
    error,
    interrupted,
    workLabel,
    setWorkLabel,
    setStatus,
    setError,
    beginLeg,
    askLeg,
    askQuiet,
    beatWork,
    beatSettle,
    handlePhase,
    setRetry: (fn: () => void) => {
      retryRef.current = fn;
    },
    retry: () => retryRef.current(),
  };
}
