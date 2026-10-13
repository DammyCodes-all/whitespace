import type { FlowGapGroup } from "@/lib/flow/contract";

/**
 * §6.8 gaps on the flow path: what a winning audience loves that the
 * pitch does not mention yet. Same yellow card as the demo bento —
 * research leads, never pitch copy. Unknown loves (hasTastes false)
 * render the no-data state, never an empty claim (§10 #4).
 */

export function GapsCard({ group }: { group: FlowGapGroup }) {
  const covered =
    group.hasTastes && group.gaps.length === 0 && group.unlabeledCount === 0;
  return (
    <div className="card h-full bg-split p-4 sm:p-5">
      <h3 className="text-base tracking-tight text-ink">
        What {group.audienceName} loves that your pitch doesn&apos;t mention yet
      </h3>
      {!group.hasTastes ? (
        <p className="mt-3 text-sm text-ink-3">
          No taste data for this audience.
        </p>
      ) : covered ? (
        <p className="mt-3 text-sm text-ink-3">
          Your pitch already mentions what this audience loves most.
        </p>
      ) : group.gaps.length === 0 ? (
        <p className="mt-3 text-sm text-ink-3">
          No taste data for this audience.
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-outline">
          {group.gaps.map((gap) => (
            <li
              key={gap.tagId}
              className="flex items-baseline justify-between gap-4 py-2"
            >
              <p className="text-[15px] tracking-tight text-ink">{gap.label}</p>
              <p
                data-numeric
                className="tnum shrink-0 font-mono text-sm text-ink"
              >
                {gap.rank}
              </p>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-sm text-white">Research leads, not pitch copy.</p>
    </div>
  );
}
