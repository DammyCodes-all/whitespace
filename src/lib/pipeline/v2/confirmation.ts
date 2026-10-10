import type {
  V2Aspect,
  V2ConfirmedAnalogy,
  V2Input,
  V2ReferenceCandidate,
  V2ReferenceLens,
  V2Result,
} from "./types.ts";

function selectedCandidate(
  lens: V2ReferenceLens,
): V2ReferenceCandidate | undefined {
  return lens.candidates.find(
    (candidate) =>
      candidate.name === lens.selectedName &&
      candidate.entityType === lens.entityType &&
      candidate.analogy === lens.analogy,
  );
}

function confirmationFor(
  aspect: V2Aspect,
  lens: V2ReferenceLens,
): V2ConfirmedAnalogy {
  if (
    lens.aspectId !== aspect.id ||
    lens.identity !== "resolved" ||
    !lens.entityId?.trim() ||
    !lens.entityName?.trim() ||
    !lens.entityType?.trim() ||
    selectedCandidate(lens) === undefined
  ) {
    throw new Error(
      "Only an exact selected, resolved bridge can be confirmed.",
    );
  }
  return {
    aspectId: aspect.id,
    facet: aspect.facet,
    excerpt: aspect.excerpt,
    interpretation: aspect.interpretation,
    entityId: lens.entityId,
    entityName: lens.entityName,
    entityType: lens.entityType,
    selectedName: lens.selectedName,
    analogy: lens.analogy,
  };
}

/** Call only with a freshly resolved lens: a client snapshot is not identity authority (§6.3). */
export function isConfirmedBridge(
  aspect: V2Aspect,
  lens: V2ReferenceLens,
  confirmations: readonly V2ConfirmedAnalogy[] | undefined,
): boolean {
  if (
    lens.aspectId !== aspect.id ||
    lens.identity !== "resolved" ||
    !lens.entityId?.trim() ||
    !lens.entityName?.trim() ||
    !lens.entityType?.trim() ||
    selectedCandidate(lens) === undefined
  ) {
    return false;
  }
  return (
    confirmations?.some(
      (confirmation) =>
        confirmation !== null &&
        confirmation.aspectId === aspect.id &&
        confirmation.facet === aspect.facet &&
        confirmation.excerpt === aspect.excerpt &&
        confirmation.interpretation === aspect.interpretation &&
        confirmation.entityId === lens.entityId &&
        confirmation.entityName === lens.entityName &&
        confirmation.entityType === lens.entityType &&
        confirmation.selectedName === lens.selectedName &&
        confirmation.analogy === lens.analogy,
    ) ?? false
  );
}

/** A confirmation is a new version of the exact brief and bridges reviewed (§6.9). */
export function buildConfirmationInput(
  result: V2Result,
  newAspectIds: string[],
): V2Input {
  const brief = result.brief;
  if (brief === null) {
    throw new Error("There is no reviewed brief to confirm.");
  }
  const requested = new Set(newAspectIds);
  const confirmedAnalogies: V2ConfirmedAnalogy[] = [];
  const references: NonNullable<V2Input["preparedBrief"]>["references"] = [];
  for (const aspect of brief.aspects) {
    const lens = result.lenses.find((entry) => entry.aspectId === aspect.id);
    if (lens === undefined) {
      if (requested.has(aspect.id)) {
        throw new Error("The requested aspect has no reviewed reference lens.");
      }
      continue;
    }
    const confirmed =
      lens.bridge === "creator-confirmation" || requested.has(aspect.id);
    if (confirmed) {
      confirmedAnalogies.push(confirmationFor(aspect, lens));
      requested.delete(aspect.id);
    }
    const candidates = confirmed
      ? [selectedCandidate(lens) as V2ReferenceCandidate]
      : lens.candidates;
    if (candidates.length > 0) {
      references.push({
        aspectId: aspect.id,
        candidates: candidates.map((candidate) => ({ ...candidate })),
      });
    }
  }
  if (requested.size > 0) {
    throw new Error("The requested aspect is not in the reviewed brief.");
  }
  return {
    pitchText: result.input.pitchText,
    workType: result.input.workType,
    ...(result.input.comparisons !== undefined
      ? { comparisons: [...result.input.comparisons] }
      : {}),
    ...(result.input.contrasts !== undefined
      ? { contrasts: [...result.input.contrasts] }
      : {}),
    correctionOf: result.runId ?? result.manifest?.runId ?? null,
    confirmedAnalogies,
    preparedBrief: {
      pitchText: result.input.pitchText,
      workType: result.input.workType,
      brief: structuredClone(brief),
      references,
    },
  };
}
