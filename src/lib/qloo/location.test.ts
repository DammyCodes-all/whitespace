/** Day 10 Q: location guard and share math. */

import assert from "node:assert/strict";
import { test } from "node:test";
import type { Audience } from "../types.ts";
import {
  fetchLocation,
  guardLocationData,
  MIN_PLACES_FOR_MAP,
  UNVERIFIED_CITY_REASON,
} from "./location.ts";

test("guard rejects thin counts and names the threshold", () => {
  assert.equal(guardLocationData(0).ok, false);
  assert.equal(guardLocationData(MIN_PLACES_FOR_MAP - 1).ok, false);
  assert.match(guardLocationData(2).reason ?? "", /2 place\(s\)/);
  assert.equal(guardLocationData(MIN_PLACES_FOR_MAP).ok, true);
  assert.equal(guardLocationData(MIN_PLACES_FOR_MAP).reason, null);
});

test("fetchLocation with no API key hides with a traced call, never throws", async () => {
  const audience: Audience = {
    id: "a1",
    kind: "hypothesis",
    name: "Test",
    titles: [
      {
        query: "Heat",
        qlooId: "movie:1",
        name: "Heat",
        type: "urn:entity:movie",
      },
    ],
    notFoundTitles: [],
  };
  const result = await fetchLocation(audience, "Lagos");
  assert.equal(result.status, "hidden");
  if (result.status === "hidden") {
    assert.ok(result.call !== null);
    // Mock payload has no places, so the thin branch names the count.
    assert.match(result.reason, /Thin location data/);
  }
});

test("fetchLocation with no resolved titles hides without a call", async () => {
  const audience: Audience = {
    id: "a2",
    kind: "hypothesis",
    name: "Empty",
    titles: [],
    notFoundTitles: [],
  };
  const result = await fetchLocation(audience, "Lagos");
  assert.deepEqual(result, {
    status: "hidden",
    reason: "Audience has no resolved titles.",
    call: null,
  });
});

test("unverified-city reason is exported for the UI hide note", () => {
  assert.match(UNVERIFIED_CITY_REASON, /no city-concentration signal/);
});
