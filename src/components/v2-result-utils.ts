import type {
  V2Input,
  V2Neighborhood,
  V2Result,
} from "../lib/pipeline/v2/types.ts";
import { v2ReplayId } from "./v2-replay.ts";

/** Editing the pitch invalidates approvals; all creator context survives. */
export function buildRevisionInput(result: V2Result): V2Input {
  return {
    pitchText: result.input.pitchText,
    workType: result.input.workType,
    comparisons: [...(result.input.comparisons ?? [])],
    contrasts: [...(result.input.contrasts ?? [])],
    correctionOf: v2ReplayId(result),
  };
}

/** Link only explicit recorded IDs, never infer citations from prose or array position. */
export function recordedEvidenceIds(
  result: V2Result,
  ids: string[] = [],
): string[] {
  const recorded = new Set((result.calls ?? []).map((call) => call.id));
  return [...new Set(ids)].filter((id) => recorded.has(id));
}

export function memberEvidenceIds(
  result: V2Result,
  group: V2Neighborhood,
  memberId: string,
): string[] {
  const groupIds = new Set(group.evidenceIds ?? []);
  return recordedEvidenceIds(
    result,
    (result.retrievals ?? []).flatMap((retrieval) =>
      retrieval.callId !== undefined &&
      groupIds.has(retrieval.callId) &&
      retrieval.entities.some((entity) => entity.id === memberId)
        ? [retrieval.callId]
        : [],
    ),
  );
}

const sensitive =
  /(?:^|[-_])(?:authorization|authentication|auth|key|token|secret|password|cookie|bearer)(?:$|[-_])|api.?key|access.?token|client.?secret/i;
function redactText(value: string): string {
  return value
    .replace(/\bBearer\s+[^\s"']+/gi, "Bearer [redacted]")
    .replace(
      /([?&](?:api[_-]?key|key|access[_-]?token|token|secret)=)[^&#\s]*/gi,
      "$1[redacted]",
    );
}
function redact(value: unknown): unknown {
  if (typeof value === "string") return redactText(value);
  if (Array.isArray(value)) return value.map(redact);
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        sensitive.test(key) ? "[redacted]" : redact(item),
      ]),
    );
  }
  return value;
}

/** Defense in depth for key-free transport traces. Text is rendered as text, never HTML. */
export function evidenceJson(value: unknown): string {
  return JSON.stringify(redact(value), null, 2) ?? "No response captured.";
}

export const LOST_RESPONSE_MESSAGE =
  "The analysis response was lost. Server-side work may already have run; usage is unknown and retrying may spend another analysis.";
