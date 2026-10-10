/** Browser/HTTP replay boundary. No pipeline execution or provider calls. */
import type { V2Result } from "../lib/pipeline/v2/types.ts";

type ObjectValue = Record<string, unknown>;
type Check = (value: unknown) => boolean;
const object = (value: unknown): value is ObjectValue =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const text: Check = (value) => typeof value === "string";
const nonempty: Check = (value) =>
  typeof value === "string" && value.trim() !== "";
const boolean: Check = (value) => typeof value === "boolean";
const count: Check = (value) =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const number: Check = (value) =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;
const oneOf =
  (...values: string[]): Check =>
  (value) =>
    typeof value === "string" && values.includes(value);
const array =
  (check: Check): Check =>
  (value) =>
    Array.isArray(value) && value.every(check);
const nullable =
  (check: Check): Check =>
  (value) =>
    value === null || check(value);
const strings = array(text);
const optional = (value: ObjectValue, key: string, check: Check) =>
  value[key] === undefined || check(value[key]);
const shape =
  (fields: Record<string, Check>): Check =>
  (value) =>
    object(value) &&
    Object.entries(fields).every(([key, check]) => check(value[key]));

const workType = oneOf("film", "music", "book", "game");
const facet = oneOf("premise", "theme", "tone", "form");
const identity = oneOf("resolved", "ambiguous", "not_found", "request_failed");
const bridge = oneOf(
  "returned-metadata",
  "creator-confirmation",
  "curated-mapping",
  "llm-provisional",
);

export function isV2RunId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,199}$/.test(value) &&
    value !== "latest"
  );
}

/** Absolute HTTP(S) only, without credentials or control characters. */
export function isSafeHttpLink(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    !/^https?:\/\//i.test(value) ||
    Array.from(value).some(
      (character) =>
        character.charCodeAt(0) < 32 ||
        character.charCodeAt(0) === 127 ||
        /\s/.test(character) ||
        character === "\\",
    )
  )
    return false;
  try {
    const url = new URL(value);
    return (
      (url.protocol === "https:" || url.protocol === "http:") &&
      url.hostname !== "" &&
      url.username === "" &&
      url.password === ""
    );
  } catch {
    return false;
  }
}

const aspect = shape({
  id: nonempty,
  facet,
  excerpt: text,
  interpretation: text,
});
const brief = shape({
  interpretation: text,
  aspects: array(aspect),
  constraints: strings,
  contrasts: strings,
  unrepresentable: strings,
});
const candidate = shape({ name: text, entityType: nonempty, analogy: text });
const confirmed = shape({
  aspectId: nonempty,
  facet,
  excerpt: text,
  interpretation: text,
  entityId: nonempty,
  entityName: text,
  entityType: nonempty,
  selectedName: text,
  analogy: text,
});
const prepared = shape({
  pitchText: text,
  workType,
  brief,
  references: array(
    shape({ aspectId: nonempty, candidates: array(candidate) }),
  ),
});
const entity = shape({
  id: nonempty,
  name: text,
  type: nonempty,
  position: (value) => count(value) && (value as number) > 0,
  tags: strings,
});
const lens: Check = (value) =>
  shape({
    aspectId: nonempty,
    candidates: array(candidate),
    selectedName: text,
    entityId: nullable(nonempty),
    entityName: nullable(text),
    entityType: nullable(nonempty),
    identity,
    bridge,
    analogy: text,
    role: oneOf("discovery", "supporting"),
  })(value) &&
  object(value) &&
  optional(value, "callId", nonempty);
const retrieval: Check = (value) =>
  shape({
    aspectId: nonempty,
    category: nonempty,
    status: oneOf("ok", "empty", "failed"),
    entities: array(entity),
    queryProvenance: text,
  })(value) &&
  object(value) &&
  optional(value, "callId", nonempty);
const exploration: Check = (value) =>
  shape({
    aspectId: nonempty,
    referenceName: nullable(text),
    bridge,
    entities: array(entity),
    queryProvenance: strings,
    suggestedAction: text,
  })(value) &&
  object(value) &&
  optional(value, "evidenceIds", strings);
const lead: Check = (value) =>
  shape({
    id: nonempty,
    name: text,
    type: nonempty,
    neighborhoodId: nonempty,
    seedIds: strings,
    category: nonempty,
    link: nullable(isSafeHttpLink),
    investigationAction: text,
    queryProvenance: text,
  })(value) &&
  object(value) &&
  optional(value, "callId", nonempty);
const explanation = shape({
  neighborhoodId: nonempty,
  name: text,
  whyInvestigate: text,
  source: oneOf("llm-grounded", "deterministic"),
});
const comparison: Check = (value) =>
  shape({
    query: text,
    entityId: nullable(nonempty),
    entityName: nullable(text),
    identity,
    category: nonempty,
    entities: array(entity),
    queryProvenance: strings,
  })(value) &&
  object(value) &&
  optional(value, "evidenceIds", strings);
const manifest = shape({
  runId: isV2RunId,
  pipelineVersion: oneOf(
    "v2-lean.1",
    "v2-lean.2",
    "v2-lean.3",
    "v2-lean.4",
    "v2-lean.5",
    "v2-lean.6",
  ),
  policyVersion: oneOf("v2-policy.1", "v2-policy.2", "v2-policy.3"),
  frozenSeedIds: strings,
  discoveryLensIds: strings,
  supportingLensIds: strings,
  targetCategories: strings,
  retrievalTake: count,
  attemptCeiling: count,
  knownFamilyLinks: array(strings),
});

/** Evidence responses are unknown JSON, not unchecked display objects. */
function json(value: unknown, depth = 0): boolean {
  if (depth > 64) return false;
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every((item) => json(item, depth + 1));
  return (
    object(value) && Object.values(value).every((item) => json(item, depth + 1))
  );
}
const call: Check = (value) =>
  shape({
    id: nonempty,
    endpoint: (v) => typeof v === "string" && /^\/(?!\/)[^?#\s]*$/.test(v),
    method: oneOf("GET"),
    params: (v) => object(v) && Object.values(v).every(text),
    status: (v) => count(v) && (v as number) <= 599,
    durationMs: number,
    at: text,
    fromCache: boolean,
    response: json,
    attempts: count,
  })(value) &&
  object(value) &&
  optional(value, "error", text) &&
  optional(value, "responseSummary", text) &&
  optional(value, "responseTruncated", boolean);

export function v2ReplayId(result: V2Result): string | null {
  return result.runId ?? result.manifest?.runId ?? null;
}

export function isLegacyV2Replay(result: V2Result): boolean {
  return /^v2-lean\.[1-5]$/.test(result.manifest?.pipelineVersion ?? "");
}

/**
 * Reject malformed nested fields before rendering or constructing corrections.
 * Only documented omissions in older versions are adapted; positional legacy
 * approvals are never promoted into exact-bridge confirmation objects.
 */
export function parseV2Result(value: unknown): V2Result | null {
  try {
    if (!object(value) || !nullable(manifest)(value.manifest)) return null;
    const version = object(value.manifest)
      ? Number(String(value.manifest.pipelineVersion).split(".")[1])
      : 6;
    const legacy = version < 6;
    if (
      !optional(value, "runId", isV2RunId) ||
      (!legacy && !isV2RunId(value.runId)) ||
      (value.runId !== undefined &&
        object(value.manifest) &&
        value.runId !== value.manifest.runId)
    )
      return null;
    if (
      !oneOf(
        "hypotheses",
        "exploration-only",
        "no-supported-hypothesis",
        "unable-to-assess",
        "needs-clarification",
        "unsupported",
      )(value.reportState) ||
      !oneOf("complete", "partial", "unavailable")(value.dataState)
    )
      return null;
    const input = value.input;
    if (
      !shape({ pitchText: text, workType })(input) ||
      !object(input) ||
      !optional(input, "comparisons", strings) ||
      !optional(input, "contrasts", strings) ||
      !optional(input, "correctionOf", nullable(isV2RunId)) ||
      !optional(input, "preparedBrief", prepared) ||
      !optional(
        input,
        "confirmedAnalogies",
        legacy ? (v) => array(confirmed)(v) || strings(v) : array(confirmed),
      )
    )
      return null;
    const neighborhood: Check = (v) =>
      shape({
        id: nonempty,
        coreMemberIds: strings,
        members: array(entity),
        sharedDescriptor: nullable(text),
        coherent: boolean,
        coverage: count,
        corroboration: count,
        pitchSupported: boolean,
      })(v) &&
      object(v) &&
      (version < 2
        ? optional(v, "supportingEvidence", strings)
        : strings(v.supportingEvidence)) &&
      optional(v, "evidenceIds", strings);
    if (
      !nullable(brief)(value.brief) ||
      !array(lens)(value.lenses) ||
      !array(neighborhood)(value.neighborhoods) ||
      !array(exploration)(value.explorations) ||
      !strings(value.limitations) ||
      !(version < 3
        ? optional(value, "leads", array(lead))
        : array(lead)(value.leads)) ||
      !(version < 4
        ? optional(value, "explanations", array(explanation))
        : array(explanation)(value.explanations)) ||
      !(version < 5
        ? optional(value, "comparisons", array(comparison))
        : array(comparison)(value.comparisons)) ||
      !optional(value, "calls", array(call)) ||
      !optional(value, "retrievals", array(retrieval))
    )
      return null;
    if (
      !shape({ httpAttempts: count, ceiling: count, llmCalls: count })(
        value.usage,
      ) ||
      !object(value.usage) ||
      !(version < 5
        ? optional(value.usage, "latencyMs", number)
        : number(value.usage.latencyMs))
    )
      return null;
    if (
      Array.isArray(value.calls) &&
      new Set(value.calls.map((c) => c.id)).size !== value.calls.length
    )
      return null;
    // This cast follows validation of every field used by the UI and correction helper.
    return {
      ...value,
      input: {
        ...input,
        ...(legacy &&
        Array.isArray(input.confirmedAnalogies) &&
        input.confirmedAnalogies.some((v) => typeof v === "string")
          ? { confirmedAnalogies: [] }
          : {}),
      },
      neighborhoods: (value.neighborhoods as ObjectValue[]).map((v) => ({
        ...v,
        supportingEvidence: v.supportingEvidence ?? [],
      })),
      leads: value.leads ?? [],
      explanations: value.explanations ?? [],
      comparisons: value.comparisons ?? [],
      usage: { ...value.usage, latencyMs: value.usage.latencyMs ?? 0 },
    } as unknown as V2Result;
  } catch {
    return null;
  }
}
