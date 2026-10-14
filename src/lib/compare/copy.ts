/**
 * Result-card copy built from data, never hardcoded.
 *
 * `buildCopy` takes the fields the result already carries — verdict, best
 * audience, control score, runner-up, named titles — and returns plain
 * template sentences, so the text can never disagree with the numbers.
 * Scores are 0–1 fractions; every one passes through `pct` exactly once.
 * No LLM is involved.
 *
 * Spec ref: §6.7 (verdict table; "Mixed" is the verdict word everywhere).
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
}

export interface ResultCopy {
  badge: string;
  body: string[];
  source: string | null;
}

function sourceLine(titles: string[]): string | null {
  const named = titles.map((t) => t.trim()).filter((t) => t !== "");
  if (named.length === 0) return null;
  if (named.length === 1) return `Based on the title you named: ${named[0]}`;
  return `Based on the titles you named: ${named.join(", ")}`;
}

export function buildCopy(input: CopyInput): ResultCopy {
  const source = sourceLine(input.titles);

  if (input.verdict === "Inconclusive" || input.best === null) {
    return {
      badge: "Inconclusive",
      body: [
        "Not enough Qloo data to judge this audience.",
        "The numbers are withheld rather than guessed.",
      ],
      source,
    };
  }

  const best = input.best;
  const badge = `${input.verdict} fit`;

  if (input.verdict === "Weak") {
    const body = [
      "No audience stands out for your idea.",
      `The closest is ${best.label} at ${pct(best.score)}%.`,
    ];
    if (input.controlScore !== null) {
      body.push(
        `Strangers to this idea match it at ${pct(input.controlScore)}%.`,
      );
    }
    return { badge, body, source };
  }

  const body = [
    input.verdict === "Strong"
      ? `${cap(best.label)} fits your idea best.`
      : `${cap(best.label)} fits your idea best, but not by much.`,
    `Their taste matches your idea at ${pct(best.score)}%.`,
  ];
  if (input.controlScore !== null) {
    body.push(
      input.verdict === "Strong"
        ? `Strangers to this idea match it at only ${pct(input.controlScore)}%.`
        : `Strangers to this idea match it at ${pct(input.controlScore)}%.`,
    );
  }
  const runnerUp = input.runnerUp;
  if (runnerUp !== null) {
    // Rivals-first: a rival runner-up is named as a rival matching too;
    // the named titles are the benchmark the winner is read against.
    if (runnerUp.role === "rival") {
      body.push(
        `A rival matches them too: ${cap(runnerUp.label)} at ${pct(runnerUp.score)}%.`,
      );
    } else if (runnerUp.role === "named") {
      body.push(
        `Your comparables agree: ${cap(runnerUp.label)} matches it at ${pct(runnerUp.score)}%.`,
      );
    } else {
      body.push(
        `${cap(runnerUp.label)} matches it at ${pct(runnerUp.score)}%.`,
      );
    }
  }
  return { badge, body, source };
}
