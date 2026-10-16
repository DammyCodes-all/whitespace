"use client";

/**
 * The results sidecars: the plain-chatbot comparison (fetched once per
 * result) and the change-and-recheck. Both spend their own calls and
 * never touch the scored run above them.
 */

import { useEffect, useRef, useState } from "react";
import type { ChatbotView } from "@/components/chatbot-preview";
import type { FlowResult } from "@/lib/flow/contract";
import type { ChangedRun } from "@/lib/pipeline/change";
import type { QlooCall } from "@/lib/types";

export interface ResultSidecars {
  chatbot: ChatbotView | null;
  chatbotError: string | null;
  compareCalls: QlooCall[];
  compareLoaded: boolean;
  changed: ChangedRun | null;
  constraint: string;
  changeBusy: boolean;
  changeError: string | null;
  setConstraint: (value: string) => void;
  checkChange: () => void;
  /** Drop everything the last result fetched — a new run replaces it. */
  reset: () => void;
}

export function useResultSidecars({
  leg,
  result,
}: {
  leg: string;
  result: FlowResult | null;
}): ResultSidecars {
  const [chatbot, setChatbot] = useState<ChatbotView | null>(null);
  const [chatbotError, setChatbotError] = useState<string | null>(null);
  const [compareCalls, setCompareCalls] = useState<QlooCall[]>([]);
  const [compareLoaded, setCompareLoaded] = useState(false);
  const [constraint, setConstraint] = useState("");
  const [changed, setChanged] = useState<ChangedRun | null>(null);
  const [changeBusy, setChangeBusy] = useState(false);
  const [changeError, setChangeError] = useState<string | null>(null);

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

  function reset() {
    setChatbot(null);
    setChatbotError(null);
    setCompareCalls([]);
    setCompareLoaded(false);
    setChanged(null);
    setChangeError(null);
  }

  return {
    chatbot,
    chatbotError,
    compareCalls,
    compareLoaded,
    changed,
    constraint,
    changeBusy,
    changeError,
    setConstraint,
    checkChange: () => {
      void checkChange();
    },
    reset,
  };
}
