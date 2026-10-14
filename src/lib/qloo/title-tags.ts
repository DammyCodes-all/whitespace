/**
 * Title-grounded tag pool for the flow. Owned by Q.
 *
 * Pure logic, no I/O, no fetch: callers (the flow runner, the
 * title-tags preview route) fetch taste lists first and hand them in.
 * The pool grounds scoring in titles the user named instead of pitch
 * words alone: the base comes off already-fetched per-title tastes,
 * the pitch's matched tags supplement it, generic tags held widely by
 * controls are cut, and an optional `pickedIds` selection (confirmed
 * by the user, or by a future LLM pass) narrows it further.
 *
 * Every candidate keeps its provenance (`source`), so hold-out
 * rounds can drop one title's gifts and the UI can badge each chip.
 *
 * Spec ref: §6.5 (only real Qloo tags reach scoring), §6.2 (similar-to
 * titles), §7 (Qloo supplies facts), §11 (caps guard quota).
 */

import type { AudienceTastes } from "../scoring/fit.ts";
import type { Audience, ResolvedTitle } from "../types.ts";

/**
 * Pool base per named title: the strongest N taste labels off that
 * title's already-fetched list. Enough to carry the title's gifts,
 * few enough to read and to keep the shared scoring list bounded.
 */
export const TITLE_TAG_TOP_N = 12;

/**
 * Generic cut: a candidate held by at least this share of the
 * control taste lists says nothing distinctive and is dropped.
 * Failed control lists hold nothing but still count in the
 * denominator, so unmeasured controls keep tags, never cut them.
 */
export const GENERIC_CONTROL_SHARE = 0.5;

/** Where a pool tag came from: pitch words or one named title. */
export type TitleTagSource = "pitch" | { titleId: string };

/** One named title's already-fetched tastes plus its identity. */
export interface NamedTasteInput {
  tastes: AudienceTastes;
  /** Qloo entity id of the title whose signal produced these tastes. */
  titleId: string;
  /** Display name of that title, for hold-out steps and chip badges. */
  titleName: string;
}

/** A pitch word that matched a real Qloo tag. */
export interface PitchMatchedTagInput {
  qlooTagId: string;
  label: string;
}

export interface TitleTagCandidate {
  /** Real Qloo tag id — the scoring key. */
  qlooTagId: string;
  /** Display name from tastes (or the pitch word for pitch tags). */
  label: string;
  source: TitleTagSource;
  /** Present exactly when `source` is a title. */
  sourceTitleName?: string;
}

export interface BuildTitleTagPoolInput {
  namedTastes: readonly NamedTasteInput[];
  pitchMatchedTags: readonly PitchMatchedTagInput[];
  controlTastes: readonly AudienceTastes[];
  /**
   * Confirmed ids; empty keeps everything. The selection itself is
   * applied by the caller (user confirm or LLM pass) — this only
   * filters to it, in pool order.
   */
  pickedIds: readonly string[];
}

function cleanId(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

/**
 * Build the combined pool: title gifts first (top {@link TITLE_TAG_TOP_N}
 * per named title, deduped by tag id, first source wins), then pitch
 * tags not already present, minus the generic cut, minus anything
 * outside `pickedIds` when a selection was confirmed. Deterministic.
 */
export function buildTitleTagPool(
  input: BuildTitleTagPoolInput,
): TitleTagCandidate[] {
  const seen = new Set<string>();
  const out: TitleTagCandidate[] = [];

  for (const named of input.namedTastes) {
    if (named.tastes.failed === true) continue;
    const ids = named.tastes.tagIds;
    const names = named.tastes.tagNames;
    const aligned = Array.isArray(names) && names.length === ids.length;
    const take = Math.min(ids.length, TITLE_TAG_TOP_N);
    for (let index = 0; index < take; index += 1) {
      const id = cleanId(ids[index]);
      if (id === null || seen.has(id)) continue;
      seen.add(id);
      const rawName = aligned ? (names as string[])[index] : undefined;
      const label =
        typeof rawName === "string" && rawName.trim() !== ""
          ? rawName.trim()
          : id;
      out.push({
        qlooTagId: id,
        label,
        source: { titleId: named.titleId },
        sourceTitleName: named.titleName,
      });
    }
  }

  for (const tag of input.pitchMatchedTags) {
    const id = cleanId(tag.qlooTagId);
    if (id === null || seen.has(id)) continue;
    seen.add(id);
    out.push({ qlooTagId: id, label: tag.label, source: "pitch" });
  }

  // Generic cut: share of control lists holding the id. Failed
  // lists hold nothing; zero control lists keep everything.
  const lists = input.controlTastes;
  const heldBy = new Map<string, number>();
  for (const tastes of lists) {
    if (tastes.failed === true) continue;
    for (const id of new Set(tastes.tagIds)) {
      if (cleanId(id) === null) continue;
      heldBy.set(id, (heldBy.get(id) ?? 0) + 1);
    }
  }
  const kept =
    lists.length === 0
      ? out
      : out.filter(
          (candidate) =>
            (heldBy.get(candidate.qlooTagId) ?? 0) / lists.length <
            GENERIC_CONTROL_SHARE,
        );

  if (input.pickedIds.length === 0) return kept;
  const picked = new Set(input.pickedIds);
  return kept.filter((candidate) => picked.has(candidate.qlooTagId));
}

/**
 * Fetch-only audiences for the pool: one single-title audience per
 * resolved title, so each taste list maps back to exactly one source
 * title for hold-out rounds. Never scored or rendered directly.
 */
export function namedTasteAudiences(
  titles: readonly ResolvedTitle[],
): Audience[] {
  return titles.map((title) => ({
    id: `title:${title.qlooId}`,
    kind: "hypothesis",
    name: title.name,
    titles: [title],
    notFoundTitles: [],
  }));
}
