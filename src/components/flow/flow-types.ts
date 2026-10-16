import type { ChatbotView } from "@/components/chatbot-preview";
import type { FlowEvidence, FlowResult } from "@/lib/flow/contract";
import type { FlowStepRow } from "@/lib/flow/view-types";
import type { ChangedRun } from "@/lib/pipeline/change";
import type { QlooCall, WorkType } from "@/lib/types";

export type FlowPhase = "input" | "tags" | "running" | "done";

export interface TitleGift {
  qlooId: string;
  label: string;
  sourceTitleId: string | null;
  sourceTitleName: string | null;
}

export interface CheckResult {
  resolved: { query: string; name: string; qlooId: string }[];
  notFound: string[];
}

export interface RunResponseBody {
  result: FlowResult;
  steps: FlowStepRow[];
  stopped: boolean;
}

export interface CompareResponseBody {
  chatbot: ChatbotView | null;
  error: string | null;
  calls: QlooCall[];
}

export interface ChangeResponseBody {
  changed?: ChangedRun;
  error?: string;
}

export type { FlowResult, FlowStepRow, ChangedRun, QlooCall, WorkType };

/** A React state setter, shared so action modules don't redeclare it. */
export type Setter<T> = React.Dispatch<React.SetStateAction<T>>;

export function callToEvidence(call: QlooCall): FlowEvidence {
  return {
    request: { endpoint: call.endpoint, params: { ...call.params } },
    response: call.responseBody ?? call.responseSummary ?? "not captured",
    truncated: call.responseTruncated ?? call.responseBody === undefined,
    status: call.status,
    fromCache: call.fromCache,
  };
}
