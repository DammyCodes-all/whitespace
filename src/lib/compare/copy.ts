/**
 * Result-card copy built from data, never hardcoded.
 *
 * `buildCopy` takes the fields the result already carries — verdict, best
 * audience, control score, runner-up, named titles, matched tags — and
 * returns plain-spoken paragraphs with every number embedded, so the text
 * can never disagree with the numbers. Scores are 0–1 fractions; every
 * one passes through `pct` exactly once. No LLM is involved: deterministic
 * templates, human voice.
 *
 * Spec ref: §6.7 (verdict table; "Mixed" is the verdict word everywhere),
 * §6.11 (measured side of the chatbot comparison).
 */

import type { Verdict } from "../types.ts";

/** The single rounding point: 0–1 score in, whole percent out. */
export function pct(score: number): number {
  return Math.round(score * 100);
}

/** Capitalise a label when it starts a sentence; labels may arrive lowercase. */
export function cap(label: string): string {
  if (label.length === 0) return label;
  return label[0].toUpperCase() + label.slice(1);
}

export interface CopyAudience {
  label: string;
  score: number;
  /** Winner/runner-up role, when the caller knows it (flow bar rows do). */
  role?: "named" | "rival" | "control";
}

export interface CopyInput {
  verdict: Verdict;
  best: CopyAudience | null;
  controlScore: number | null;
  runnerUp: CopyAudience | null;
  titles: string[];
  /** Matched tag labels behind the top audience, strongest first. */
  matchedTags?: string[];
}

export interface ResultCopy {
  badge: string;
  body: string[];
  source: string | null;
}

function sourceLine(titles: string[]): string | null {
  const named = titles.map((t) => t.trim()).filter((t) => t !== "");
  if (named.length === 0) return null;
  if (named.length === 1)
    return `Checked against the title you named: ${named[0]}.`;
  return `Checked against the titles you named: ${named.join(", ")}.`;
}

function cleanTags(tags: string[] | undefined): string[] {
  if (tags === undefined) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const tag = raw.trim();
    if (tag === "") continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
    if (out.length >= 3) break;
  }
  return out;
}

function runnerSentence(runnerUp: CopyAudience): string {
  const score = `${pct(runnerUp.score)}%`;
  if (runnerUp.role === "rival") {
    return `And a rival reads it too: ${cap(runnerUp.label)} at ${score}. Two crowds, both checked.`;
  }
  if (runnerUp.role === "named") {
    return `The fans of the titles you named back it up: ${cap(runnerUp.label)} at ${score} on the same likes.`;
  }
  return `${cap(runnerUp.label)} sits at ${score} too.`;
}

export function buildCopy(input: CopyInput): ResultCopy {
  const source = sourceLine(input.titles);

  if (input.verdict === "Inconclusive" || input.best === null) {
    return {
      badge: "Inconclusive",
      body: [
        "Not enough Qloo data to judge this one. Numbers stay hidden instead of guessed.",
      ],
      source,
    };
  }

  const best = input.best;
  const badge = `${input.verdict} fit`;
  const landed = cleanTags(input.matchedTags);

  if (input.verdict === "Weak") {
    const body = [
      `No audience stands out here. Closest is ${best.label} at ${pct(best.score)}%.`,
    ];
    if (input.controlScore !== null) {
      body.push(
        `Strangers match it at ${pct(input.controlScore)}%. Flat room.`,
      );
    }
    if (landed.length > 0) {
      body.push(`What landed: ${landed.join(", ")}.`);
    }
    return { badge, body, source };
  }

  const hedged = input.verdict === "Mixed";
  const opener =
    input.controlScore !== null
      ? hedged
        ? `${cap(best.label)} leads at ${pct(best.score)}%, but not by much. Strangers sit at ${pct(input.controlScore)}%.`
        : `${cap(best.label)} fits this idea best. What they like puts them at ${pct(best.score)}%. Strangers land at only ${pct(input.controlScore)}%.`
      : hedged
        ? `${cap(best.label)} leads at ${pct(best.score)}%, but not by much.`
        : `${cap(best.label)} fits this idea best. What they like puts them at ${pct(best.score)}%.`;
  const body = [opener];
  if (input.runnerUp !== null) {
    body.push(runnerSentence(input.runnerUp));
  }
  if (landed.length > 0) {
    body.push(`What landed: ${landed.join(", ")}.`);
  }
  return { badge, body, source };
}
