import Link from "next/link";

/**
 * The fixture demo's front door, as a nav link. /demo/flow mirrors the
 * landing entry, then hands off to /demo/run, where the whole OrbFlow
 * runs on fixtures (zero AI or Qloo calls). The visible label stays
 * short for the nav; the accessible name keeps the full promise.
 *
 * Spec ref: §5 (journey), §6.10 (static sample output page).
 */
export function SampleRunLink() {
  return (
    <Link
      href="/demo/flow"
      aria-label="See a 10-second sample run"
      className="text-sm text-ink-2 transition-colors hover:text-ink"
    >
      10s sample run
    </Link>
  );
}
