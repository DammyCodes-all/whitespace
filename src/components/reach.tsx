import type { RelatedKind, RelatedResult } from "@/lib/qloo/related";
import type { GapItem } from "@/lib/scoring/gaps";
import type { Audience } from "@/lib/types";

/**
 * Day 7 U: reach plan with source links. Owned by U.
 *
 * Server Component rendering one block per reach audience: four
 * category shelves plus the loves-but-lacks gap list. Every item links
 * its Qloo call (§6.12); empty categories render the no-data state,
 * never a zero (§10 #4). Gaps are research leads, never pitch copy,
 * and say so (§6.8).
 */

export interface ReachAudience {
  audience: Audience;
  /** "Best fit" or "Runner-up · Split verdict". */
  headline: string;
  related: RelatedResult[];
  gaps: GapItem[];
  unlabeledCount: number;
  /** Traces the tastes call behind the gaps (§6.12). */
  tastesCallId?: string;
}

const KIND_ORDER: RelatedKind[] = ["podcast", "person", "brand", "place"];

const KIND_LABELS: Record<RelatedKind, string> = {
  podcast: "Podcasts",
  person: "People",
  brand: "Brands",
  place: "Places",
};

function byKindOrder(a: RelatedResult, b: RelatedResult): number {
  return KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind);
}

function CategoryShelf({ group }: { group: RelatedResult }) {
  return (
    <div className="border-b border-rule py-4">
      <h3 className="text-base tracking-tight text-ink">
        {KIND_LABELS[group.kind]}
      </h3>
      {group.items.length === 0 ? (
        <p className="nodata mt-2 px-2 py-2 font-mono text-xs text-ink-2">
          not measured
        </p>
      ) : (
        <ul className="mt-2">
          {group.items.map((item) => (
            <li
              key={item.entityId}
              className="flex items-baseline justify-between gap-4 py-1"
            >
              <p className="text-[15px] tracking-tight text-ink">{item.name}</p>
              <p
                data-numeric
                className="tnum shrink-0 font-mono text-sm text-ink"
              >
                {item.affinityRank}
                <a
                  href={`#${item.callId}`}
                  className="cite ml-1"
                  aria-label={`Evidence for ${item.name}`}
                >
                  [e]
                </a>
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function GapList({
  audienceName,
  gaps,
  unlabeledCount,
  tastesCallId,
}: {
  audienceName: string;
  gaps: GapItem[];
  unlabeledCount: number;
  tastesCallId?: string;
}) {
  return (
    <div className="border-b border-rule py-4">
      <h3 className="text-base tracking-tight text-ink">
        What {audienceName} loves that your pitch doesn&apos;t mention yet
      </h3>
      {gaps.length === 0 ? (
        <p className="nodata mt-2 px-2 py-2 font-mono text-xs text-ink-2">
          not measured
        </p>
      ) : (
        <ul className="mt-2">
          {gaps.map((gap) => (
            <li
              key={gap.tagId}
              className="flex items-baseline justify-between gap-4 py-1"
            >
              <p className="text-[15px] tracking-tight text-ink">{gap.label}</p>
              <p
                data-numeric
                className="tnum shrink-0 font-mono text-sm text-ink"
              >
                {gap.rank}
                {tastesCallId !== undefined && (
                  <a
                    href={`#${tastesCallId}`}
                    className="cite ml-1"
                    aria-label={`Evidence for ${gap.label}`}
                  >
                    [e]
                  </a>
                )}
              </p>
            </li>
          ))}
        </ul>
      )}
      {unlabeledCount > 0 && (
        <p data-numeric className="mt-2 font-mono text-xs text-ink-3">
          +{unlabeledCount} untracked
        </p>
      )}
      <p className="mt-2 text-sm text-ink-3">Research leads, not pitch copy.</p>
    </div>
  );
}

export function ReachPlan({ groups }: { groups: ReachAudience[] }) {
  if (groups.length === 0) {
    return (
      <section aria-label="Reach plan" className="mt-12">
        <h2 className="text-lg tracking-tight text-ink">Reach plan</h2>
        <p className="nodata mt-4 px-2 py-2 font-mono text-xs text-ink-2">
          not measured: no reliable fit, no reach plan
        </p>
      </section>
    );
  }
  return (
    <section aria-label="Reach plan" className="mt-12">
      <h2 className="text-lg tracking-tight text-ink">Reach plan</h2>
      {groups.map((group) => (
        <div key={group.audience.id} className="mt-4">
          <p className="font-serif text-base text-ink">
            {group.audience.name}{" "}
            <span className="font-mono text-xs text-ink-3">
              {group.headline}
            </span>
          </p>
          <div className="mt-2 border-t border-rule">
            {[...group.related].sort(byKindOrder).map((related, index) => (
              <CategoryShelf key={`${related.kind}-${index}`} group={related} />
            ))}
            <GapList
              audienceName={group.audience.name}
              gaps={group.gaps}
              unlabeledCount={group.unlabeledCount}
              tastesCallId={group.tastesCallId}
            />
          </div>
        </div>
      ))}
    </section>
  );
}
