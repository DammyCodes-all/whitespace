/**
 * Day 10 Q: location call with thin-data guard. Owned by Q.
 *
 * §6.8 city view is optional and cut first (§12). The hackathon
 * developer guide lists no city-concentration signal or filter for
 * `/v2/insights`, so today this module fails closed: it makes the
 * place-association call (same verified shape as Day 7 related),
 * feeds results through the thin-data guard, and renders the map
 * hidden with a machine-readable reason whenever the data cannot
 * ground a city claim. It never fabricates a location result.
 *
 * When a verified city-scoping parameter lands, the only change is
 * dropping today's `UNVERIFIED_CITY_REASON` branch — the guard,
 * the share normalization, and the return shape stay put.
 *
 * Spec ref: §6.8 (city view, relative concentration only, thin →
 * hide with reason), §10 #4 (no-data renders honestly), §6.12
 * (every call traced), §12 (city map cut first).
 */

import type { Audience, QlooCall } from "@/lib/types";
import { QlooError, qlooFetch } from "./client.ts";
import { extractRelated } from "./related.ts";

/**
 * Minimum place results before a map is allowed to render. Below this
 * the data is thin (§6.8) and the UI must show the reason instead.
 */
export const MIN_PLACES_FOR_MAP = 5;

export interface LocationPlace {
  entityId: string;
  name: string;
  /**
   * Relative share of concentration in [0, 1]; shares sum to 1.
   * Derived from Qloo rank order — never a headcount, never a score
   * (§6.8, §11).
   */
  share: number;
}

export type LocationResult =
  | { status: "ok"; city: string; places: LocationPlace[]; callId: string }
  | { status: "hidden"; reason: string; call: QlooCall | null };

/** Reason the map stays hidden until a city filter is verified live. */
export const UNVERIFIED_CITY_REASON =
  "Qloo's hackathon API exposes no city-concentration signal, so the map stays hidden.";

/**
 * §6.8 thin-data guard: a map only renders with enough places to mean
 * something. Fewer than MIN_PLACES_FOR_MAP is thin by definition,
 * regardless of what the city query returned.
 */
export function guardLocationData(placeCount: number): {
  ok: boolean;
  reason: string | null;
} {
  if (placeCount < MIN_PLACES_FOR_MAP) {
    return {
      ok: false,
      reason: `Thin location data: ${placeCount} place(s), need ${MIN_PLACES_FOR_MAP} or more.`,
    };
  }
  return { ok: true, reason: null };
}

/**
 * Rank order to relative shares: weight = 1 / (rank), normalized so
 * the shares sum to 1. Monotone decreasing, 0 when empty, never NaN.
 * Relative concentration only (§6.8) — no headcounts, no scores.
 */
/**
 * §6.8 city view. Never throws on Qloo failure (mirrors Day 7
 * `fetchRelatedKind`): any failure returns `hidden` with the trace.
 *
 * Today the fetch result can never justify showing a map — the
 * hackathon surface exposes no city-scoping parameter, so the guard
 * output is always the hide branch until that is verified. The call
 * still runs so the evidence list traces it (§6.12) and the caching /
 * quota behavior is exercised.
 */
export async function fetchLocation(
  audience: Audience,
  city: string,
): Promise<LocationResult> {
  if (typeof window !== "undefined") {
    throw new Error(
      "fetchLocation is server-only and cannot run in the browser.",
    );
  }
  const ids = audience.titles
    .map((t) => t.qlooId)
    .filter((id) => id.trim() !== "")
    .slice(0, 5);
  if (ids.length === 0) {
    return {
      status: "hidden",
      reason: "Audience has no resolved titles.",
      call: null,
    };
  }
  try {
    const { data, trace } = await qlooFetch("/v2/insights", {
      "signal.interests.entities": ids.join(","),
      "filter.type": "urn:entity:place",
      take: "8",
    });
    const places = extractRelated(data, "place", trace.id);
    const thin = guardLocationData(places.length);
    if (!thin.ok && thin.reason !== null) {
      return { status: "hidden", reason: thin.reason, call: trace };
    }
    // Data arrived but cannot be attributed to the requested city:
    // fail closed until a verified city filter exists.
    return {
      status: "hidden",
      reason: `${UNVERIFIED_CITY_REASON} (requested: ${city})`,
      call: trace,
    };
  } catch (err) {
    if (err instanceof QlooError) {
      return { status: "hidden", reason: err.message, call: err.trace };
    }
    throw err;
  }
}
