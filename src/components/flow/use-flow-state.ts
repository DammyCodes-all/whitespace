"use client";

import { useState } from "react";
import type { ChatbotView } from "@/components/chatbot-preview";
import type {
  ChangedRun,
  CheckResult,
  FlowPhase,
  FlowResult,
  FlowStepRow,
  QlooCall,
  TitleGift,
  WorkType,
} from "@/components/flow/flow-types";
import { parseSimilarTitles } from "@/lib/flow/similar-titles";

/** All flow state in one hook so the orchestrator stays small. */
export function useFlowState(initialPitch: string) {
  const [phase, setPhase] = useState<FlowPhase>("input");
  const [pitchText, setPitchText] = useState(initialPitch);
  const [workType, setWorkType] = useState<WorkType>("film");
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
  const [checkBusy, setCheckBusy] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [checkResult, setCheckResult] = useState<CheckResult | null>(null);

  const matched = tags.filter((t) => t.status === "matched").length;
  const parsedSimilar = parseSimilarTitles(similarTitles);

  return {
    phase,
    setPhase,
    pitchText,
    setPitchText,
    workType,
    setWorkType,
    similarTitles,
    setSimilarTitles,
    qlooSuggestions,
    setQlooSuggestions,
    suggestBusy,
    setSuggestBusy,
    suggestDone,
    setSuggestDone,
    titleTags,
    setTitleTags,
    titleTagsBusy,
    setTitleTagsBusy,
    titleTagsDone,
    setTitleTagsDone,
    cutGifts,
    setCutGifts,
    showCutGifts,
    setShowCutGifts,
    previewNote,
    setPreviewNote,
    tags,
    setTags,
    steps,
    setSteps,
    result,
    setResult,
    error,
    setError,
    busy,
    setBusy,
    chatbot,
    setChatbot,
    chatbotError,
    setChatbotError,
    compareCalls,
    setCompareCalls,
    compareLoaded,
    setCompareLoaded,
    constraint,
    setConstraint,
    changed,
    setChanged,
    changeBusy,
    setChangeBusy,
    changeError,
    setChangeError,
    checkBusy,
    setCheckBusy,
    checkError,
    setCheckError,
    checkResult,
    setCheckResult,
    matched,
    parsedSimilar,
  };
}

export type FlowState = ReturnType<typeof useFlowState>;
