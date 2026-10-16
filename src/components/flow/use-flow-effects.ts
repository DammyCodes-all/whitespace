"use client";

import { useEffect, useRef } from "react";
import type { ChatbotView } from "@/components/chatbot-preview";
import { extractTagsAction } from "@/components/flow/flow-run-actions";
import type {
  CompareResponseBody,
  FlowPhase,
  FlowResult,
  QlooCall,
  Setter,
} from "@/components/flow/flow-types";
import type { WorkType } from "@/lib/types";

/**
 * Mount-only sidecars: URL-pitch auto-start + post-result chatbot compare.
 * Spec: §6.11 (compare never gates the verdict).
 */
export function useFlowEffects({
  autoStart,
  initialPitch,
  s,
}: {
  autoStart: boolean;
  initialPitch: string;
  s: {
    pitchText: string;
    workType: WorkType;
    phase: FlowPhase;
    result: FlowResult | null;
    setBusy: Setter<boolean>;
    setError: Setter<string | null>;
    setTags: Setter<FlowResult["tags"]>;
    setWorkType: Setter<WorkType>;
    setPhase: Setter<FlowPhase>;
    setChatbot: Setter<ChatbotView | null>;
    setChatbotError: Setter<string | null>;
    setCompareCalls: Setter<QlooCall[]>;
    setCompareLoaded: Setter<boolean>;
  };
}) {
  const {
    pitchText,
    workType,
    phase,
    result,
    setBusy,
    setError,
    setTags,
    setWorkType,
    setPhase,
    setChatbot,
    setChatbotError,
    setCompareCalls,
    setCompareLoaded,
  } = s;
  const autoStarted = useRef(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: mount-only auto-start
  useEffect(() => {
    if (autoStart && initialPitch.trim() !== "" && !autoStarted.current) {
      autoStarted.current = true;
      void extractTagsAction(pitchText, workType, {
        setBusy,
        setError,
        setTags,
        setWorkType,
        setPhase,
      });
    }
  }, []);

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
  }, [
    phase,
    result,
    setChatbot,
    setChatbotError,
    setCompareCalls,
    setCompareLoaded,
  ]);
}
