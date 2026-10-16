"use client";

/**
 * Each leg's primary action, plus the hint shown when it is not yet
 * ready. The hints name the one thing missing — never a guessed count
 * of what is in flight.
 */

import { MIN_MATCHED_TAGS } from "@/lib/config";

/** Tags leg: the pool looks right, move on to naming similar work. */
export function TagsCtas({
  onContinue,
  onEditPitch,
}: {
  onContinue: () => void;
  onEditPitch: () => void;
}) {
  return (
    <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
      <button
        type="button"
        onClick={onContinue}
        className="btn-primary px-6 py-3 text-sm"
      >
        These look right, continue
      </button>
      <button
        type="button"
        onClick={onEditPitch}
        className="btn-secondary px-5 py-3 text-sm"
      >
        Edit the pitch
      </button>
    </div>
  );
}

/** Titles leg: review the full pool once the titles have been checked. */
export function TitlesCta({
  checked,
  named,
  onReview,
}: {
  /** A Check has run at least once. */
  checked: boolean;
  /** At least one title is named. */
  named: boolean;
  onReview: () => void;
}) {
  return (
    <div className="mt-6 flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={onReview}
        disabled={!checked || !named}
        className="btn-primary px-6 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
      >
        Review the full tag set
      </button>
      {!checked && (
        <p className="font-mono text-xs text-clay">
          Check the titles first. Suggestions only come from verified ones.
        </p>
      )}
    </div>
  );
}

/** Aggregate leg: score — once the pool gate is met. */
export function ScoreCta({
  canRun,
  similarCount,
  onRun,
}: {
  canRun: boolean;
  /** Parsed similar titles, for naming what the gate is missing. */
  similarCount: number;
  onRun: () => void;
}) {
  return (
    <div className="mt-6 flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={onRun}
        disabled={!canRun}
        className="btn-primary px-6 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
      >
        Score my idea
      </button>
      {!canRun && (
        <p className="font-mono text-xs text-clay">
          {similarCount < 1
            ? "Add at least one similar title. Your tags get built from it."
            : `${MIN_MATCHED_TAGS} tags minimum. Add sharper words or titles.`}
        </p>
      )}
    </div>
  );
}
