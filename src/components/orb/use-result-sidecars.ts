"use client";

/**
 * The results sidecar: the plain-chatbot comparison, fetched once per
 * result. It spends its own calls and never touches the scored run
 * above it.
 */

import { useEffect, useRef, useState } from "react";
import type { ChatbotView } from "@/components/chatbot-preview";
import type { FlowResult } from "@/lib/flow/contract";
import type { QlooCall } from "@/lib/types";

export interface ResultSidecars {
  chatbot: ChatbotView | null;
  chatbotError: string | null;
  compareCalls: QlooCall[];
  compareLoaded: boolean;
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

  function reset() {
    setChatbot(null);
    setChatbotError(null);
    setCompareCalls([]);
    setCompareLoaded(false);
  }

  return {
    chatbot,
    chatbotError,
    compareCalls,
    compareLoaded,
    reset,
  };
}
