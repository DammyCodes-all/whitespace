/**
 * Day 6.5 U: decode the pitch form's `?input=` into a `PipelineInput`.
 * Owned by U.
 *
 * Pure function, exported for unit tests. Absent or invalid input falls
 * back to `demoPipelineInput` (§6.1, §9). Next.js already percent-decodes
 * `searchParams` once, so this parses the raw value as-is: decoding again
 * corrupts pitches containing `%` (e.g. "100% improvised"). Only
 * single-encoded links (what the form emits) are accepted.
 */

import type { WorkType } from "@/lib/types";
import { demoPipelineInput, type PipelineInput } from "../pipeline/run.ts";

const WORK_TYPES: WorkType[] = ["film", "music", "book", "game"];

function strings(value: unknown, cap: number): string[] {
  return Array.isArray(value)
    ? value
        .filter((v): v is string => typeof v === "string")
        .map((v) => v.trim())
        .filter(Boolean)
        .slice(0, cap)
    : [];
}

function decodeInput(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function parseRunInput(
  raw: string | string[] | undefined,
): PipelineInput {
  if (typeof raw !== "string" || raw === "") return demoPipelineInput;
  const data: unknown = decodeInput(raw);
  if (typeof data !== "object" || data === null) return demoPipelineInput;
  const root = data as Record<string, unknown>;
  const workType =
    typeof root.workType === "string" &&
    WORK_TYPES.includes(root.workType as WorkType)
      ? (root.workType as WorkType)
      : demoPipelineInput.workType;
  const pitchText =
    typeof root.pitchText === "string" && root.pitchText.trim() !== ""
      ? root.pitchText.trim().slice(0, 5000)
      : demoPipelineInput.pitchText;
  const rivalProposals = Array.isArray(root.rivalProposals)
    ? root.rivalProposals.slice(0, 5).map((r: unknown, i: number) => {
        const o =
          typeof r === "object" && r !== null
            ? (r as Record<string, unknown>)
            : {};
        return {
          id:
            typeof o.id === "string" && o.id.trim() !== ""
              ? o.id.trim().slice(0, 40)
              : `rival-${i + 1}`,
          name:
            typeof o.name === "string" && o.name.trim() !== ""
              ? o.name.trim().slice(0, 80)
              : `Rival ${i + 1}`,
          reason:
            typeof o.reason === "string" && o.reason.trim() !== ""
              ? o.reason.trim().slice(0, 200)
              : "",
          titles: strings(o.titles, 5),
        };
      })
    : demoPipelineInput.rivalProposals;
  return {
    pitchText,
    workType,
    nothingLike: strings(root.nothingLike, 5),
    constraint:
      typeof root.constraint === "string" ? root.constraint : undefined,
    similarTitles: strings(root.similarTitles, 10),
    candidateWords: strings(root.candidateWords, 20),
    pinnedWords: strings(root.pinnedWords, 20),
    rivalProposals,
  };
}
