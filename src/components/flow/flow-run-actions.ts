import type { ChatbotView } from "@/components/chatbot-preview";
import type {
  ChangeResponseBody,
  FlowPhase,
  FlowResult,
  RunResponseBody,
  Setter,
  TitleGift,
} from "@/components/flow/flow-types";
import { parseSimilarTitles } from "@/lib/flow/similar-titles";
import type { FlowStepRow } from "@/lib/flow/view-types";
import type { ChangedRun } from "@/lib/pipeline/change";
import type { QlooCall, WorkType } from "@/lib/types";

export async function extractTagsAction(
  pitchText: string,
  workType: WorkType,
  set: {
    setBusy: Setter<boolean>;
    setError: Setter<string | null>;
    setTags: Setter<FlowResult["tags"]>;
    setWorkType: Setter<WorkType>;
    setPhase: Setter<FlowPhase>;
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
    setBusy: Setter<boolean>;
    setError: Setter<string | null>;
    setSteps: Setter<FlowStepRow[]>;
    setPhase: Setter<FlowPhase>;
    setResult: Setter<FlowResult | null>;
    setChatbot: Setter<ChatbotView | null>;
    setChatbotError: Setter<string | null>;
    setCompareCalls: Setter<QlooCall[]>;
    setCompareLoaded: Setter<boolean>;
    setChanged: Setter<ChangedRun | null>;
    setChangeError: Setter<string | null>;
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
    setChangeBusy: Setter<boolean>;
    setChangeError: Setter<string | null>;
    setChanged: Setter<ChangedRun | null>;
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
