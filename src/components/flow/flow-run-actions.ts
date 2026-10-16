"use client";

import { parseSimilarTitles } from "@/lib/flow/similar-titles";
import type { ChatbotView } from "@/components/chatbot-preview";
import type {
  ChangeResponseBody,
  FlowPhase,
  FlowResult,
  RunResponseBody,
  TitleGift,
} from "@/components/flow/flow-types";
import type { FlowStepRow } from "@/lib/flow/view-types";
import type { ChangedRun } from "@/lib/pipeline/change";
import type { QlooCall, WorkType } from "@/lib/types";

type Set<T> = React.Dispatch<React.SetStateAction<T>>;

export async function extractTagsAction(
  pitchText: string,
  workType: WorkType,
  set: {
    setBusy: Set<boolean>;
    setError: Set<string | null>;
    setTags: Set<FlowResult["tags"]>;
    setWorkType: Set<WorkType>;
    setPhase: Set<FlowPhase>;
  },
) {
  set.setBusy(true);
  set.setError(null);
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
      set.setError(data.error ?? "Could not read the pitch tags.");
      return;
    }
    set.setTags(data.tags ?? []);
    const nextType =
      data.workType === "film" ||
      data.workType === "music" ||
      data.workType === "book" ||
      data.workType === "game"
        ? data.workType
        : workType;
    set.setWorkType(nextType);
    set.setPhase("tags");
  } catch {
    set.setError("Could not reach the tag matcher.");
  } finally {
    set.setBusy(false);
  }
}

export async function runAnalysisAction(
  args: {
    pitchText: string;
    workType: WorkType;
    tags: FlowResult["tags"];
    similarTitles: string;
    titleTags: TitleGift[];
  },
  set: {
    setBusy: Set<boolean>;
    setError: Set<string | null>;
    setSteps: Set<FlowStepRow[]>;
    setPhase: Set<FlowPhase>;
    setResult: Set<FlowResult | null>;
    setChatbot: Set<ChatbotView | null>;
    setChatbotError: Set<string | null>;
    setCompareCalls: Set<QlooCall[]>;
    setCompareLoaded: Set<boolean>;
    setChanged: Set<ChangedRun | null>;
    setChangeError: Set<string | null>;
  },
) {
  set.setBusy(true);
  set.setError(null);
  set.setSteps([]);
  set.setPhase("running");
  try {
    const res = await fetch("/api/flow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pitchText: args.pitchText,
        workType: args.workType,
        tags: args.tags,
        similarTitles: parseSimilarTitles(args.similarTitles),
        pickedTagIds: args.titleTags.map((t) => t.qlooId),
      }),
    });
    const data = (await res.json()) as RunResponseBody & { error?: string };
    if (!res.ok) {
      set.setError(data.error ?? "The run failed.");
      set.setPhase("tags");
      return;
    }
    set.setSteps(data.steps ?? []);
    set.setResult(data.result);
    set.setChatbot(null);
    set.setChatbotError(null);
    set.setCompareCalls([]);
    set.setCompareLoaded(false);
    set.setChanged(null);
    set.setChangeError(null);
    set.setPhase("done");
  } catch {
    set.setError("The run failed. The page is unaffected.");
    set.setPhase("tags");
  } finally {
    set.setBusy(false);
  }
}

export async function checkChangeAction(
  result: FlowResult | null,
  constraint: string,
  changeBusy: boolean,
  set: {
    setChangeBusy: Set<boolean>;
    setChangeError: Set<string | null>;
    setChanged: Set<ChangedRun | null>;
  },
) {
  if (result === null || constraint.trim() === "" || changeBusy) return;
  set.setChangeBusy(true);
  set.setChangeError(null);
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
      set.setChangeError(data.error ?? "The recheck failed.");
      return;
    }
    set.setChanged(data.changed);
  } catch {
    set.setChangeError("The recheck failed. The run above is unaffected.");
  } finally {
    set.setChangeBusy(false);
  }
}
