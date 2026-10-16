import type { FlightRect } from "@/components/entry-box";
import type { OrbLeg } from "@/lib/orb/orb-status";

/** Which leg of the run the orb is on. */
export type Leg = OrbLeg;

/**
 * One taste a checked title gifted to the pool: the Qloo entity behind
 * it plus the title it came from, so chips badge `[Title name]` and the
 * hold-out rounds can drop one title's gifts.
 */
export interface TitleGift {
  qlooId: string;
  label: string;
  sourceTitleId: string | null;
  sourceTitleName: string | null;
}

/** What one explicit Check resolved to, as the run page holds it. */
export interface CheckResult {
  resolved: { query: string; name: string; qlooId: string }[];
  notFound: string[];
}

/** The landing box's state while it hands over to the run page. The
 *  twin renders at `target` (the pill) and condenses in place — `rect`
 *  sizes the opening card frame so it lands as the box it came from. */
export interface OrbFlightState {
  rect: FlightRect;
  target: FlightRect;
  pitch: string;
}
