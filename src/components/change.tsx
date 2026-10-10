import { changeReason, REAL_PEOPLE_LINE } from "@/components/change-copy";
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
  const rise = after - before;
  const sign = rise >= 0 ? "+" : "";
  return (
    <p
      data-numeric
      className={`tnum font-mono text-sm ${onInk ? "text-paper" : "text-measured"}`}
    >
      {before.toFixed(2)} → {after.toFixed(2)} ({sign}
      {rise.toFixed(2)})
    </p>
  );
}

export function ChangeView({ changed }: { changed: ChangedRun }) {
  const { check } = changed;
  const recheckId = changed.calls[0]?.id;

  if (!check.accepted) {
    return (
      <div className="rounded-2xl border-2 border-outline bg-ink p-5">
        <p className="font-serif text-base text-paper">Change withheld</p>
        <p className="mt-2 text-sm text-paper">
          {check.failedCondition !== undefined
            ? changeReason(check.failedCondition)
            : "The change did not clear the bar."}
        </p>
        <div className="mt-2">
          <Delta before={check.before} after={check.after} onInk />
        </div>
        <p className="mt-2 text-sm text-paper">{REAL_PEOPLE_LINE}</p>
      </div>
    );
  }

  return (
    <div className="border-b border-rule py-4">
      <p className="font-serif text-base text-ink">
        Change clears the bar
        {recheckId !== undefined && (
          <a
            href={`#${recheckId}`}
            className="cite ml-1"
            aria-label="Evidence for the recheck"
          >
            [e]
          </a>
        )}
      </p>
      <Delta before={check.before} after={check.after} />
      <p className="mt-2 max-w-prose text-body text-ink-2">
        {changed.proposedPitch}
      </p>
      {changed.usedGapLabels.length > 0 && (
        <p className="mt-2 font-mono text-xs text-ink-3">
          Addresses: {changed.usedGapLabels.join(", ")}
        </p>
      )}
    </div>
  );
}
