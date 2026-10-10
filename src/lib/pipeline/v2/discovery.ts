/**
 * V2 discovery assessment, pure logic (lean MVP). Owned by S.
 *
 * Forms taste neighborhoods from frozen retrievals in code — never in
 * the LLM. Overlap-only grouping: core entities returned under at
 * least two distinct discovery aspect families, then one candidate
 * group per lens pair with coherence from shared returned tags.
 * Retries within one aspect still count as one lens. Supporting
 * retrieval adds an evidence flag and can reorder groups; it never
 * creates members or changes C/X (§4F).
 *
 * No Qloo calls, no LLM calls, no affinity averaging. Duplicate
 * entities never inflate counts; ties are ties (stable id order for
 * display only).
 *
 * Proposal ref: pipeline-redesign §§4D–4F.
 */

import {
  EXPLORATION_PER_LENS,
  isBridgeEligible,
  JACCARD_THRESHOLD,
  MAX_NEIGHBORHOODS,
  type V2Exploration,
  type V2LensRetrieval,
  type V2Neighborhood,
  type V2ReferenceLens,
  type V2ReturnedEntity,
} from "./types.ts";

/** Administrative/category-only tags carry no coherence signal. */
const IGNORED_TAG_PATTERN = /^(urn:entity|category|type|admin)/i;

/** Local mirror of Q's normalizeKey (S-owned file, no import). */
function normalizeName(value: string): string {
  return value.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Drop every frozen seed id from counted results, including
 * supporting and creator-comparison seeds (§4D). Runs locally even
 * when the server-side exclude filter was sent.
 */
export function excludeFrozenSeeds(
  entities: V2ReturnedEntity[],
  frozenSeedIds: string[],
): V2ReturnedEntity[] {
  const banned = new Set(frozenSeedIds);
  return entities.filter((e) => !banned.has(e.id));
}

/**
 * Core entities: returned under ≥2 distinct discovery aspect
 * families. Multiple queries/retries from one aspect count once —
 * callers pass one retrieval list per aspect family.
 */
export function findCoreEntities(
  perAspect: { aspectId: string; entities: V2ReturnedEntity[] }[],
): Map<string, { entity: V2ReturnedEntity; aspectIds: Set<string> }> {
  const seen = new Map<
    string,
    { entity: V2ReturnedEntity; aspectIds: Set<string> }
  >();
  for (const { aspectId, entities } of perAspect) {
    const once = new Set<string>();
    for (const e of entities) {
      if (once.has(e.id)) continue;
      once.add(e.id);
      const hit = seen.get(e.id);
      if (hit === undefined) {
        seen.set(e.id, { entity: e, aspectIds: new Set([aspectId]) });
      } else {
        hit.aspectIds.add(aspectId);
      }
    }
  }
  for (const [id, entry] of [...seen]) {
    if (entry.aspectIds.size < 2) seen.delete(id);
  }
  return seen;
}

/**
 * Flag known family dependence: distinct ids whose normalized names
 * match collapse to one work/family for counting (§4C). Heuristic on
 * names only — never claim de-duplication beyond available metadata.
 */
export function collapseFamilies(
  ids: string[],
  byId: Map<string, V2ReturnedEntity>,
): string[][] {
  const groups = new Map<string, string[]>();
  for (const id of ids) {
    const key = normalizeName(byId.get(id)?.name ?? id);
    const list = groups.get(key) ?? [];
    list.push(id);
    groups.set(key, list);
  }
  return [...groups.values()].filter((g) => g.length > 1);
}

/** Known duplicate references cannot stand in for distinct pitch perspectives. */
function independentLenses(
  lenses: V2ReferenceLens[],
  priorLenses: V2ReferenceLens[] = [],
): V2ReferenceLens[] {
  const byAspect = new Map<string, V2ReferenceLens[]>();
  for (const lens of lenses) {
    const list = byAspect.get(lens.aspectId) ?? [];
    list.push(lens);
    byAspect.set(lens.aspectId, list);
  }
  const referenceName = (lens: V2ReferenceLens): string =>
    normalizeName(lens.entityName ?? lens.selectedName);
  const aspects = new Set(priorLenses.map((lens) => lens.aspectId));
  const references = new Set(priorLenses.map((lens) => lens.entityId));
  const names = new Set(priorLenses.map(referenceName).filter(Boolean));
  const kept: V2ReferenceLens[] = [];
  for (const [aspectId, list] of byAspect) {
    const lens = list[0];
    // Conflicting records for one aspect have no safe pooled attribution.
    if (
      list.some(
        (other) =>
          other.entityId !== lens.entityId ||
          referenceName(other) !== referenceName(lens) ||
          other.identity !== lens.identity ||
          other.bridge !== lens.bridge,
      )
    )
      continue;
    const name = referenceName(lens);
    if (
      lens.identity !== "resolved" ||
      lens.entityId === null ||
      aspects.has(aspectId) ||
      references.has(lens.entityId) ||
      (name !== "" && names.has(name))
    )
      continue;
    aspects.add(aspectId);
    references.add(lens.entityId);
    if (name !== "") names.add(name);
    kept.push(lens);
  }
  return kept;
}

function countFamilies(entities: Iterable<V2ReturnedEntity>): number {
  return new Set(
    [...entities].map((entity) => normalizeName(entity.name) || entity.id),
  ).size;
}

function retrievalEvidenceIds(
  retrievals: V2LensRetrieval[],
  contributes: (retrieval: V2LensRetrieval) => boolean,
): string[] {
  return [
    ...new Set(
      retrievals.flatMap((retrieval) =>
        retrieval.status === "ok" && retrieval.callId && contributes(retrieval)
          ? [retrieval.callId]
          : [],
      ),
    ),
  ].sort();
}

function meaningfulTags(entity: V2ReturnedEntity): Set<string> {
  return new Set(entity.tags.filter((t) => !IGNORED_TAG_PATTERN.test(t)));
}

/**
 * Whether an entity carries any coherence-grade tags. Used by the
 * detail-enrichment proviso (§8): tag-less core members are the only
 * ones worth an exact-name lookup.
 */
export function hasMeaningfulTags(entity: V2ReturnedEntity): boolean {
  return meaningfulTags(entity).size > 0;
}

/** Entity-set Jaccard similarity for near-duplicate suppression. */
export function jaccard(
  a: ReadonlySet<string>,
  b: ReadonlySet<string>,
): number {
  if (a.size === 0 && b.size === 0) return 1;
  let shared = 0;
  for (const x of a) if (b.has(x)) shared += 1;
  return shared / (a.size + b.size - shared);
}

/**
 * Form candidate neighborhoods. Lean rule: all shared cores across
 * the eligible discovery lenses form one candidate; coherence needs
 * ≥2 distinct works/families sharing a returned descriptor. Provisional
 * bridges contribute observed overlap only — they never set coverage.
 */
export function formNeighborhoods(
  cores: Map<string, { entity: V2ReturnedEntity; aspectIds: Set<string> }>,
  lenses: V2ReferenceLens[],
  runId: string,
  retrievals: V2LensRetrieval[] = [],
): V2Neighborhood[] {
  const discovery = independentLenses(
    lenses.filter((lens) => lens.role === "discovery"),
  );
  const observed = new Set(discovery.map((lens) => lens.aspectId));
  const eligible = new Set(
    discovery.filter(isBridgeEligible).map((lens) => lens.aspectId),
  );
  const independentCores = new Map<
    string,
    { entity: V2ReturnedEntity; aspectIds: Set<string> }
  >();
  for (const [id, entry] of cores) {
    const aspectIds = new Set(
      [...entry.aspectIds].filter((aspectId) => observed.has(aspectId)),
    );
    if (aspectIds.size >= 2)
      independentCores.set(id, { entity: entry.entity, aspectIds });
  }
  if (independentCores.size === 0) return [];
  let coreIds = [...independentCores.keys()].sort();
  const byId = new Map<string, V2ReturnedEntity>(
    [...independentCores.values()].map((c) => [c.entity.id, c.entity]),
  );
  const familyOf = (id: string): string =>
    normalizeName(byId.get(id)?.name ?? id) || id;

  // Shared-descriptor: most frequent meaningful tag held by ≥2
  // distinct families. No shared tag → reference overlap only.
  const tagHolders = new Map<string, Set<string>>();
  for (const id of coreIds) {
    const fam = familyOf(id);
    for (const tag of meaningfulTags(byId.get(id) as V2ReturnedEntity)) {
      const holders = tagHolders.get(tag) ?? new Set<string>();
      holders.add(fam);
      tagHolders.set(tag, holders);
    }
  }
  let sharedDescriptor: string | null = null;
  let bestHolders = 0;
  for (const [tag, holders] of [...tagHolders].sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0,
  )) {
    if (holders.size >= 2 && holders.size > bestHolders) {
      bestHolders = holders.size;
      sharedDescriptor = tag;
    }
  }

  if (sharedDescriptor !== null) {
    coreIds = coreIds.filter((id) =>
      meaningfulTags(byId.get(id) as V2ReturnedEntity).has(
        sharedDescriptor as string,
      ),
    );
  }
  const members = new Map([...independentCores].filter(([id]) => coreIds.includes(id)));
  const coveringList = [...eligible]
    .filter(
      (aspectId) =>
        countFamilies(
          [...members.values()]
            .filter((entry) => entry.aspectIds.has(aspectId))
            .map((entry) => entry.entity),
        ) >= 2,
    )
    .sort();
  const corroboration = countCoveringPairs(members, coveringList);
  return [
    {
      id: `${runId}:n1`,
      coreMemberIds: coreIds,
      members: coreIds.map((id) => byId.get(id) as V2ReturnedEntity),
      sharedDescriptor,
      coherent: sharedDescriptor !== null,
      coverage: coveringList.length,
      corroboration,
      pitchSupported: coveringList.length >= 2 && corroboration > 0,
      supportingEvidence: [],
      evidenceIds: retrievalEvidenceIds(retrievals, (retrieval) =>
        retrieval.entities.some((entity) =>
          members.get(entity.id)?.aspectIds.has(retrieval.aspectId),
        ),
      ),
    },
  ];
}

/** Eligible aspect pairs sharing ≥2 distinct core works/families (§6.6). */
function countCoveringPairs(
  cores: Map<string, { entity: V2ReturnedEntity; aspectIds: Set<string> }>,
  covering: string[],
): number {
  let pairs = 0;
  for (let i = 0; i < covering.length; i += 1) {
    for (let j = i + 1; j < covering.length; j += 1) {
      const shared = [...cores.values()]
        .filter(
          (entry) =>
            entry.aspectIds.has(covering[i]) &&
            entry.aspectIds.has(covering[j]),
        )
        .map((entry) => entry.entity);
      if (countFamilies(shared) >= 2) pairs += 1;
    }
  }
  return pairs;
}

/** Order by coverage, then corroboration, then supporting evidence,
 *  then stable id (§4F). Supporting never outranks discovery evidence;
 *  it only breaks C/X ties. Equal evidence is a tie, not a
 *  manufactured winning margin. */
export function orderNeighborhoods(groups: V2Neighborhood[]): V2Neighborhood[] {
  const supportCount = (g: V2Neighborhood): number =>
    Array.isArray(g.supportingEvidence) ? g.supportingEvidence.length : 0;
  const ordered = [...groups]
    .filter((g) => g.pitchSupported && g.coherent)
    .sort(
      (a, b) =>
        b.coverage - a.coverage ||
        b.corroboration - a.corroboration ||
        supportCount(b) - supportCount(a) ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    );
  return dedupeNeighborhoods(ordered).slice(0, MAX_NEIGHBORHOODS);
}

/**
 * Apply frozen supporting retrieval to already-formed candidates
 * (§4F). Membership is frozen before this runs: supporting entity
 * sets can only flag coverage of existing core members, never add
 * members, repair grouping, or reseed. A supporting aspect covers a
 * group when its bridge is eligible and its pooled retrieval
 * (categories pooled, duplicates collapsed) contains at least two
 * distinct frozen member families. Optional discovery lenses exclude
 * reuse of a discovery aspect/reference as purported additional support.
 */
export function applySupportingEvidence(
  groups: V2Neighborhood[],
  supportingRetrievals: V2LensRetrieval[],
  supportingLenses: V2ReferenceLens[],
  discoveryLenses: V2ReferenceLens[] = [],
): V2Neighborhood[] {
  const eligible = new Set(
    independentLenses(supportingLenses, discoveryLenses)
      .filter(isBridgeEligible)
      .map((l) => l.aspectId),
  );
  if (eligible.size === 0 || groups.length === 0) return groups;
  const pooled = new Map<string, Set<string>>();
  for (const r of supportingRetrievals) {
    if (r.status !== "ok" || !eligible.has(r.aspectId)) continue;
    const ids = pooled.get(r.aspectId) ?? new Set<string>();
    for (const e of r.entities) ids.add(e.id);
    pooled.set(r.aspectId, ids);
  }
  return groups.map((g) => {
    const core = new Set(g.coreMemberIds);
    const covering: string[] = [];
    for (const [aspectId, ids] of pooled) {
      const shared = g.members.filter(
        (member) => core.has(member.id) && ids.has(member.id),
      );
      if (countFamilies(shared) >= 2) covering.push(aspectId);
    }
    covering.sort();
    return covering.length === 0
      ? g
      : {
          ...g,
          supportingEvidence: [
            ...new Set([...(g.supportingEvidence ?? []), ...covering]),
          ].sort(),
          evidenceIds: [
            ...new Set([
              ...(g.evidenceIds ?? []),
              ...retrievalEvidenceIds(
                supportingRetrievals,
                (retrieval) =>
                  covering.includes(retrieval.aspectId) &&
                  retrieval.entities.some((entity) => core.has(entity.id)),
              ),
            ]),
          ].sort(),
        };
  });
}

/**
 * Suppress near-duplicate groups (Jaccard ≥ threshold). Lean MVP
 * forms at most one candidate, but the contract holds for later.
 */
export function dedupeNeighborhoods(
  groups: V2Neighborhood[],
  threshold: number = JACCARD_THRESHOLD,
): V2Neighborhood[] {
  const kept: V2Neighborhood[] = [];
  for (const g of groups) {
    const ids = new Set(g.coreMemberIds);
    if (kept.some((k) => jaccard(ids, new Set(k.coreMemberIds)) >= threshold)) {
      continue;
    }
    kept.push(g);
  }
  return kept;
}

/**
 * Bounded explorations: up to three returned entities per lens with
 * provenance and an investigation action. No group label, no
 * pitch-corroboration badge (§4E).
 */
export function buildExplorations(
  retrievals: V2LensRetrieval[],
  lenses: V2ReferenceLens[],
): V2Exploration[] {
  const lensByAspect = new Map(lenses.map((l) => [l.aspectId, l]));
  const byAspect = new Map<string, V2LensRetrieval[]>();
  for (const r of retrievals) {
    if (r.status !== "ok") continue;
    const list = byAspect.get(r.aspectId) ?? [];
    list.push(r);
    byAspect.set(r.aspectId, list);
  }
  const out: V2Exploration[] = [];
  for (const [aspectId, list] of [...byAspect].sort(([a], [b]) =>
    a < b ? -1 : 1,
  )) {
    const lens = lensByAspect.get(aspectId);
    const seen = new Set<string>();
    const top: V2ReturnedEntity[] = [];
    for (const r of list) {
      for (const e of r.entities) {
        if (top.length >= EXPLORATION_PER_LENS) break;
        if (seen.has(e.id)) continue;
        seen.add(e.id);
        top.push(e);
      }
    }
    if (top.length === 0) continue;
    out.push({
      aspectId,
      referenceName: lens?.entityName ?? null,
      bridge: lens?.bridge ?? "llm-provisional",
      entities: top,
      queryProvenance: list
        .filter((r) => r.entities.some((entity) => seen.has(entity.id)))
        .map((r) => r.queryProvenance),
      evidenceIds: retrievalEvidenceIds(list, (retrieval) =>
        retrieval.entities.some((entity) => seen.has(entity.id)),
      ),
      suggestedAction:
        "Ask people familiar with two of these works to react to the pitch or a sample.",
    });
  }
  return out;
}
