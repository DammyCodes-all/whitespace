import { changeReason, REAL_PEOPLE_LINE } from "@/components/change-copy";
import type { ChangedRun } from "@/lib/pipeline/change";

/**
 * Day 8 U: change-and-recheck view. Owned by U.
 *
 * Server Component rendering one `ChangedRun`: accepted shows the
 * before/after scores with the rise in measured-teal (the accent is
 * spent only on measurement); withheld renders in the refusal family —
 * dashed no-data framing, zero accent, the failed condition in plain
 * words plus the mandated real-people line (§6.9). A withheld change
 * is a complete state, never an error box (§10 #5).
 */

function Delta({ before, after }: { before: number; after: number }) {
  const rise = after - before;
  const sign = rise >= 0 ? "+" : "";
  return (
    <p data-numeric className="tnum font-mono text-sm text-measured">
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
      <div className="border-b border-rule py-4">
        <p className="font-serif text-base text-ink">Change withheld</p>
        <p className="nodata mt-2 px-2 py-2 font-mono text-xs text-ink-2">
          not measured:{" "}
          {check.failedCondition !== undefined
            ? changeReason(check.failedCondition)
            : "The change did not clear the bar."}
        </p>
        <Delta before={check.before} after={check.after} />
        <p className="mt-2 text-sm text-ink-3">{REAL_PEOPLE_LINE}</p>
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
