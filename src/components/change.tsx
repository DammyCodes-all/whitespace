import {
  ACCEPTED_TITLE,
  changeReason,
  changeScoreLine,
  gapLine,
  REAL_PEOPLE_LINE,
  WITHHELD_FALLBACK,
} from "@/components/change-copy";
import type { ChangedRun } from "@/lib/pipeline/change";

/**
 * Day 8 U: change-and-recheck view. Owned by U.
 *
 * Server Component rendering one `ChangedRun`: accepted shows the
 * before/after scores with the rise in measured green (the accent is
 * spent only on measurement); withheld renders as a solid ink refusal
 * block with paper text — a refusal (design-direction.md §1, §3), never
 * an error box and never the no-data hatch (§10 #5). The failed
 * condition reads in plain words plus the mandated real-people line
 * (§6.9). A withheld change is a complete state, never an error box.
 */

function Delta({
  before,
  after,
  onInk = false,
}: {
  before: number;
  after: number;
  onInk?: boolean;
}) {
  return (
    <p
      data-numeric
      className={`tnum font-mono text-sm ${onInk ? "text-paper" : "text-ink"}`}
    >
      {changeScoreLine(before, after)}
    </p>
  );
}

export function ChangeView({ changed }: { changed: ChangedRun }) {
  const { check } = changed;

  if (!check.accepted) {
    return (
      <div className="rounded-2xl border-2 border-outline bg-ink p-5 h-full">
        <p className="font-serif text-base text-paper">Change withheld</p>
        <p className="mt-2 text-sm text-paper">
          {check.failedCondition !== undefined
            ? changeReason(check.failedCondition)
            : WITHHELD_FALLBACK}
        </p>
        <div className="mt-2">
          <Delta before={check.before} after={check.after} onInk />
        </div>
        <p className="mt-2 text-sm text-paper">{REAL_PEOPLE_LINE}</p>
      </div>
    );
  }

  const gaps = gapLine(changed.usedGapLabels);
  return (
    <div className="card h-full bg-strong p-5">
      <p className="font-serif text-base text-ink">{ACCEPTED_TITLE}</p>
      <div className="mt-2">
        <Delta before={check.before} after={check.after} />
      </div>
      <p className="mt-2 max-w-prose text-body text-ink">
        {changed.proposedPitch}
      </p>
      {gaps !== null && (
        <p className="mt-2 font-mono text-xs text-ink">{gaps}</p>
      )}
    </div>
  );
}
