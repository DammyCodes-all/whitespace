/**
 * Day 1 mock run. Owned by U.
 *
 * Lives under src/lib/demo (not src/lib/fixtures) so U can render the
 * /run skeleton without touching Q-owned fixture files. Shapes conform
 * to src/lib/types.ts, frozen Day 1. Replaced by the Day 6 runPipeline()
 * seam; mocks stay as the saved-run fallback (§9 demo plan, §10 #6).
 *
 * Spec ref: §5.4 (watch the agent work), §6.7 (verdict + margins),
 * §6.12 (every claim opens its Qloo call).
 */

import type {
  Audience,
  FitScore,
  PitchInput,
  QlooCall,
  RunStep,
  VerdictResult,
} from "@/lib/types";

export const mockInput: PitchInput = {
  pitchText:
    "A quiet science-fiction film about a lonely worker on a space station.",
  workType: "film",
  nothingLike: ["Fast franchise action"],
};

export const mockSteps: RunStep[] = [
  {
    id: "hypothesis",
    label: "Hypothesis audience",
    status: "done",
    detail: "4 checked, 3 found, 1 not found",
    callId: "call-search-1",
  },
  {
    id: "rivals",
    label: "Rival readings",
    status: "done",
    detail: "3 built, 0 replaced",
    callId: "call-search-2",
  },
  {
    id: "controls",
    label: "Control audiences",
    status: "done",
    detail: "20 unrelated",
    callId: "call-insights-1",
  },
  {
    id: "tags",
    label: "Pitch tags",
    status: "done",
    detail: "coverage 4 of 6",
    callId: "call-search-3",
  },
  {
    id: "score",
    label: "Fit scores",
    status: "active",
    detail: "rank-normalized 0 to 1",
  },
  { id: "verdict", label: "Control test and verdict", status: "pending" },
];

export const mockAudiences: Audience[] = [
  {
    id: "hyp",
    kind: "hypothesis",
    name: "Slow science-fiction",
    titles: [
      {
        query: "Moon",
        qlooId: "moon-id",
        name: "Moon",
        type: "urn:entity:movie",
      },
      {
        query: "Arrival",
        qlooId: "arrival-id",
        name: "Arrival",
        type: "urn:entity:movie",
      },
    ],
  },
  {
    id: "rival-lit",
    kind: "rival",
    name: "Literary fiction about isolation",
    reason: "Reads the station as solitude, not spectacle.",
    titles: [
      {
        query: "Never Let Me Go",
        qlooId: "nlmg-id",
        name: "Never Let Me Go",
        type: "urn:entity:book",
      },
    ],
  },
  {
    id: "rival-amb",
    kind: "rival",
    name: "Ambient music listeners",
    reason: "Reads the quiet as the point, not the setting.",
    titles: [
      {
        query: "Brian Eno",
        qlooId: "eno-id",
        name: "Brian Eno",
        type: "urn:entity:artist",
      },
    ],
  },
];

export const mockScores: FitScore[] = [
  {
    audienceId: "rival-lit",
    score: 0.72,
    matchedTags: ["solitude", "slow-burn"],
    zeroTags: ["space"],
    noDataTags: [],
  },
  {
    audienceId: "hyp",
    score: 0.61,
    matchedTags: ["slow-burn", "space"],
    zeroTags: ["solitude"],
    noDataTags: [],
  },
  {
    audienceId: "rival-amb",
    score: 0.44,
    matchedTags: ["quiet"],
    zeroTags: ["solitude"],
    noDataTags: ["slow-burn"],
  },
];

export const mockVerdict: VerdictResult = {
  verdict: "Strong",
  topAudienceId: "rival-lit",
  marginTopVsSecond: 0.11,
  marginTopVsControl: 0.28,
  clearsControl: true,
  surprise: true,
};

export const mockCalls: QlooCall[] = [
  {
    id: "call-search-1",
    endpoint: "/search",
    method: "GET",
    params: { query: "Moon", types: "urn:entity:movie" },
    status: 200,
    durationMs: 212,
    at: new Date().toISOString(),
    fromCache: true,
  },
  {
    id: "call-search-2",
    endpoint: "/search",
    method: "GET",
    params: { query: "Never Let Me Go" },
    status: 200,
    durationMs: 188,
    at: new Date().toISOString(),
    fromCache: true,
  },
  {
    id: "call-insights-1",
    endpoint: "/v2/insights",
    method: "GET",
    params: { "signal.interests.entities": "moon-id" },
    status: 200,
    durationMs: 342,
    at: new Date().toISOString(),
    fromCache: true,
  },
  {
    id: "call-search-3",
    endpoint: "/search",
    method: "GET",
    params: { query: "slow-burn tag" },
    status: 200,
    durationMs: 96,
    at: new Date().toISOString(),
    fromCache: true,
  },
];
