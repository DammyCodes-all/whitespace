import type { RelatedKind, RelatedResult } from "@/lib/qloo/related";
import type { GapItem } from "@/lib/scoring/gaps";
import type { Audience } from "@/lib/types";

/**
 * Day 7 U: reach plan with source links. Owned by U.
 *
 * Server Component rendering one block per reach audience: the picks
 * regrouped as three ordered steps (listen, find, fit in) plus the
 * loves-but-lacks gap list. Every item keeps its rank (§6.8); empty
 * kinds render the no-data state, never a zero (§10 #4). Gaps are
 * research leads, never pitch copy, and say so (§6.8).
 */

export interface ReachAudience {
  audience: Audience;
  /** "Best fit" or "Runner-up · Mixed verdict". */
  headline: string;
  related: RelatedResult[];
  gaps: GapItem[];
  unlabeledCount: number;
  /** False when tastes failed or came back empty: gaps are unknown, not zero. */
  hasTastes?: boolean;
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

function itemsOf(
  groups: RelatedResult[],
  kind: RelatedKind,
): RelatedResult["items"] {
  return groups.filter((g) => g.kind === kind).flatMap((g) => g.items);
}

function PickRows({ items }: { items: RelatedResult["items"] }) {
  return (
    <ul className="mt-2 divide-y divide-rule">
      {items.map((item) => (
        <li
          key={item.entityId}
          className="flex items-baseline justify-between gap-4 py-2"
        >
          <p className="text-[15px] tracking-tight text-ink">{item.name}</p>
          <p data-numeric className="tnum shrink-0 font-mono text-sm text-ink">
            their #{item.affinityRank}
          </p>
        </li>
      ))}
    </ul>
  );
}

function EmptyKind() {
  return (
    <p className="nodata mt-3 px-2 py-2 font-mono text-xs text-ink-2">
      not measured
    </p>
  );
}

function KindBlock({
  label,
  items,
}: {
  label: string;
  items: RelatedResult["items"];
}) {
  return (
    <div className="mt-3">
      <h4 className="text-base tracking-tight text-ink">{label}</h4>
      {items.length === 0 ? <EmptyKind /> : <PickRows items={items} />}
    </div>
  );
}

function GapList({
  audienceName,
  gaps,
  unlabeledCount,
  hasTastes = true,
}: {
  audienceName: string;
  gaps: GapItem[];
  unlabeledCount: number;
  hasTastes?: boolean;
}) {
  const covered = hasTastes && gaps.length === 0 && unlabeledCount === 0;
  const unlabeled =
    hasTastes && unlabeledCount > 0 ? (
      <p className="mt-2 font-mono text-xs text-ink-2">
        +{unlabeledCount} more{" "}
        {unlabeledCount === 1 ? "taste has" : "tastes have"} no label, counted
        not shown
      </p>
    ) : null;
  return (
    <div className="card h-full bg-split p-4 sm:p-5">
      <h3 className="text-base tracking-tight text-ink">
        What {audienceName} loves that your pitch doesn&apos;t mention yet
      </h3>
      {!hasTastes ? (
        <p className="mt-3 text-sm text-ink-3">
          No taste data for this audience.
        </p>
      ) : covered ? (
        <p className="mt-3 text-sm text-ink-3">
          Your pitch already mentions what this audience loves most.
        </p>
      ) : gaps.length === 0 ? (
        <p className="mt-3 text-sm text-ink-3">
          Every other love Qloo named had no label, so there is nothing to list.
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-outline">
          {gaps.map((gap) => (
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
      {unlabeled}
      <p className="mt-2 text-sm text-white">Research leads, not pitch copy.</p>
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
      {groups.map((group) => {
        const sorted = [...group.related].sort(byKindOrder);
        const totalItems = sorted.reduce(
          (sum, related) => sum + related.items.length,
          0,
        );
        const kindsMeasured = sorted.filter(
          (related) => related.items.length > 0,
        ).length;
        return (
          <div key={group.audience.id} className="mt-6">
            <p className="font-serif text-base text-ink">
              {group.audience.name}{" "}
              <span className="font-mono text-xs text-ink-3">
                {group.headline}
              </span>
            </p>
            <p className="mt-1 font-mono text-xs text-ink-2">
              <span data-numeric className="tnum">
                {totalItems} picks across {kindsMeasured} of the 4 kinds.
              </span>
            </p>
            <div className="mt-4 grid gap-4">
              <div className="card bg-weak p-4 sm:p-5">
                <p className="font-mono text-xs uppercase tracking-[0.12em] text-ink-3">
                  Step 1 · Listen first
                </p>
                <p className="mt-1 text-sm text-ink-2">
                  Start with what they listen to.
                </p>
                <KindBlock
                  label={KIND_LABELS.podcast}
                  items={itemsOf(sorted, "podcast")}
                />
              </div>
              <div className="card bg-split p-4 sm:p-5">
                <p className="font-mono text-xs uppercase tracking-[0.12em] text-ink-3">
                  Step 2 · Find them
                </p>
                <p className="mt-1 text-sm text-ink-2">
                  Voices they follow, places they go.
                </p>
                <KindBlock
                  label={KIND_LABELS.person}
                  items={itemsOf(sorted, "person")}
                />
                <KindBlock
                  label={KIND_LABELS.place}
                  items={itemsOf(sorted, "place")}
                />
              </div>
              <div className="card bg-strong p-4 sm:p-5">
                <p className="font-mono text-xs uppercase tracking-[0.12em] text-ink-3">
                  Step 3 · Fit in
                </p>
                <p className="mt-1 text-sm text-ink-2">
                  Brands already in their lives.
                </p>
                <KindBlock
                  label={KIND_LABELS.brand}
                  items={itemsOf(sorted, "brand")}
                />
              </div>
            </div>
            <div className="mt-4">
              <GapList
                audienceName={group.audience.name}
                gaps={group.gaps}
                unlabeledCount={group.unlabeledCount}
                hasTastes={group.hasTastes}
              />
            </div>
          </div>
        );
      })}
    </section>
  );
}
