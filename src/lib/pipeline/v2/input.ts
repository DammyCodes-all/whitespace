import {
  toV2BriefProposal,
  V2_MAX_ASPECTS,
  V2_MAX_CANDIDATES,
  type V2BriefProposal,
} from "../../agent/v2-brief.ts";
import type {
  V2Aspect,
  V2ConfirmedAnalogy,
  V2Input,
  V2ReferenceCandidate,
} from "./types.ts";

export type V2InputParseResult =
  | { ok: true; input: V2Input }
  | { ok: false; error: string };

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(
  value: unknown,
  maxLength = Number.POSITIVE_INFINITY,
): value is string {
  return (
    typeof value === "string" &&
    value.trim() !== "" &&
    value.length <= maxLength
  );
}

function workType(value: unknown): value is V2Input["workType"] {
  return (
    value === "film" ||
    value === "music" ||
    value === "book" ||
    value === "game"
  );
}

function strings(
  value: unknown,
  cap: number,
  maxLength: number,
): string[] | null {
  if (!Array.isArray(value) || value.length > cap) return null;
  const out: string[] = [];
  for (const entry of value) {
    if (!text(entry, maxLength)) return null;
    out.push(entry);
  }
  return out;
}

function normalized(value: string): string {
  return value.normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();
}

function confirmations(
  value: unknown,
  pitchText: string,
): V2ConfirmedAnalogy[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > V2_MAX_ASPECTS) return null;
  const out: V2ConfirmedAnalogy[] = [];
  const ids = new Set<string>();
  for (const raw of value) {
    if (
      !object(raw) ||
      !text(raw.aspectId) ||
      !text(raw.facet) ||
      !text(raw.excerpt, 300) ||
      !text(raw.interpretation, 300) ||
      !text(raw.entityId) ||
      !text(raw.entityName) ||
      !text(raw.entityType) ||
      !text(raw.selectedName, 120) ||
      !text(raw.analogy, 300) ||
      ids.has(raw.aspectId)
    )
      return null;
    ids.add(raw.aspectId);
    out.push({
      aspectId: raw.aspectId,
      facet: raw.facet as V2Aspect["facet"],
      excerpt: raw.excerpt,
      interpretation: raw.interpretation,
      entityId: raw.entityId,
      entityName: raw.entityName,
      entityType: raw.entityType,
      selectedName: raw.selectedName,
      analogy: raw.analogy,
    });
  }
  try {
    toV2BriefProposal(
      {
        interpretation: "Creator-confirmed reference bridges.",
        aspects: out,
        references: out.map((bridge, aspectIndex) => ({
          aspectIndex,
          candidates: [
            {
              name: bridge.selectedName,
              entityType: bridge.entityType,
              analogy: bridge.analogy,
            },
          ],
        })),
      },
      pitchText,
    );
  } catch {
    return null;
  }
  return out;
}

function preparedProposal(
  value: unknown,
  pitchText: string,
  type: V2Input["workType"],
  approved: V2ConfirmedAnalogy[],
): V2BriefProposal | null {
  if (
    !object(value) ||
    value.pitchText !== pitchText ||
    value.workType !== type ||
    !object(value.brief) ||
    !Array.isArray(value.references)
  )
    return null;
  const rawBrief = value.brief;
  if (
    !text(rawBrief.interpretation, 300) ||
    !Array.isArray(rawBrief.aspects) ||
    rawBrief.aspects.length > V2_MAX_ASPECTS ||
    value.references.length > V2_MAX_ASPECTS
  )
    return null;
  const constraints = strings(rawBrief.constraints, 5, 200);
  const contrasts = strings(rawBrief.contrasts, 5, 200);
  const unrepresentable = strings(rawBrief.unrepresentable, 5, 200);
  if (constraints === null || contrasts === null || unrepresentable === null)
    return null;
  const aspects: V2Aspect[] = [];
  const aspectIndex = new Map<string, number>();
  for (const raw of rawBrief.aspects) {
    if (
      !object(raw) ||
      !text(raw.id) ||
      aspectIndex.has(raw.id) ||
      !text(raw.facet) ||
      !text(raw.excerpt, 300) ||
      !text(raw.interpretation, 300)
    )
      return null;
    aspectIndex.set(raw.id, aspects.length);
    aspects.push({
      id: raw.id,
      facet: raw.facet as V2Aspect["facet"],
      excerpt: raw.excerpt,
      interpretation: raw.interpretation,
    });
  }
  const references: V2BriefProposal["references"] = [];
  const referenceIds = new Set<string>();
  for (const raw of value.references) {
    if (
      !object(raw) ||
      !text(raw.aspectId) ||
      !aspectIndex.has(raw.aspectId) ||
      referenceIds.has(raw.aspectId) ||
      !Array.isArray(raw.candidates) ||
      raw.candidates.length === 0 ||
      raw.candidates.length > V2_MAX_CANDIDATES
    )
      return null;
    referenceIds.add(raw.aspectId);
    const candidates: V2ReferenceCandidate[] = [];
    const candidateIds = new Set<string>();
    for (const candidate of raw.candidates) {
      if (
        !object(candidate) ||
        !text(candidate.name, 120) ||
        !text(candidate.entityType) ||
        !text(candidate.analogy, 300)
      )
        return null;
      const key = JSON.stringify([
        candidate.entityType,
        normalized(candidate.name),
      ]);
      if (candidateIds.has(key)) return null;
      candidateIds.add(key);
      candidates.push({
        name: candidate.name,
        entityType: candidate.entityType,
        analogy: candidate.analogy,
      });
    }
    references.push({ aspectId: raw.aspectId, candidates });
  }
  const brief = {
    interpretation: rawBrief.interpretation,
    aspects,
    constraints,
    contrasts,
    unrepresentable,
  };
  try {
    // Reuse semantic checks, but discard regenerated positional ids and normalized text.
    toV2BriefProposal(
      {
        ...brief,
        references: references.map((reference) => ({
          aspectIndex: aspectIndex.get(reference.aspectId),
          candidates: reference.candidates,
        })),
      },
      pitchText,
    );
  } catch {
    return null;
  }
  for (const bridge of approved) {
    const aspect = aspects.find((entry) => entry.id === bridge.aspectId);
    const reference = references.find(
      (entry) => entry.aspectId === bridge.aspectId,
    );
    if (
      aspect === undefined ||
      reference === undefined ||
      aspect.facet !== bridge.facet ||
      aspect.excerpt !== bridge.excerpt ||
      aspect.interpretation !== bridge.interpretation
    )
      return null;
    const candidate = reference.candidates.find(
      (entry) =>
        entry.name === bridge.selectedName &&
        entry.entityType === bridge.entityType &&
        entry.analogy === bridge.analogy,
    );
    if (candidate === undefined) return null;
    // Re-resolution must not silently fall back to an unapproved alternative (§6.3).
    reference.candidates = [candidate];
  }
  return { brief, references };
}

/** Validate reuse, not identity: the parent must freshly resolve and exact-match each bridge. */
export function validatePreparedBrief(input: V2Input): V2BriefProposal | null {
  if (!text(input.pitchText) || !workType(input.workType)) return null;
  const approved = confirmations(input.confirmedAnalogies, input.pitchText);
  if (approved === null) return null;
  return preparedProposal(
    input.preparedBrief,
    input.pitchText,
    input.workType,
    approved,
  );
}

/** Pure HTTP boundary. No provider, environment, or transport access. */
export function parseV2Input(value: unknown): V2InputParseResult {
  if (!object(value))
    return { ok: false, error: "An object body is required." };
  if (!text(value.pitchText))
    return { ok: false, error: "pitchText is required." };
  if (!workType(value.workType))
    return { ok: false, error: "workType is invalid." };
  const comparisons =
    value.comparisons === undefined ? [] : strings(value.comparisons, 5, 500);
  const contrasts =
    value.contrasts === undefined ? [] : strings(value.contrasts, 5, 500);
  if (comparisons === null || contrasts === null) {
    return {
      ok: false,
      error:
        "comparisons and contrasts must be arrays of at most five nonempty strings (500 characters each).",
    };
  }
  if (
    value.correctionOf !== undefined &&
    value.correctionOf !== null &&
    (!text(value.correctionOf, 200) ||
      !/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(value.correctionOf) ||
      value.correctionOf === "latest")
  ) {
    return {
      ok: false,
      error: "correctionOf must be a nonempty string or null.",
    };
  }
  const approved = confirmations(value.confirmedAnalogies, value.pitchText);
  if (approved === null) {
    return {
      ok: false,
      error:
        "confirmedAnalogies must contain valid, distinct exact bridge records.",
    };
  }
  const input: V2Input = {
    pitchText: value.pitchText,
    workType: value.workType,
    comparisons,
    contrasts,
    correctionOf: value.correctionOf ?? null,
    confirmedAnalogies: approved,
  };
  if (value.preparedBrief !== undefined) {
    const proposal = preparedProposal(
      value.preparedBrief,
      input.pitchText,
      input.workType,
      approved,
    );
    if (proposal === null) {
      return {
        ok: false,
        error:
          "preparedBrief must match the exact pitch, work type, aspects, and selected bridges.",
      };
    }
    input.preparedBrief = {
      pitchText: input.pitchText,
      workType: input.workType,
      ...proposal,
    };
  }
  return { ok: true, input };
}
