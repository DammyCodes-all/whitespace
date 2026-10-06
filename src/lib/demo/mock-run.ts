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
 *
 * Audience ids here double as keys into the Q-owned taste fixtures
 * (src/lib/fixtures/taste-lists.ts); renaming one breaks that fetch.
 */

import type { ChangedRun } from "@/lib/pipeline/change";
import type { RelatedResult } from "@/lib/qloo/related";
import type { GapItem } from "@/lib/scoring/gaps";
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
    notFoundTitles: ["Dune"],
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
    notFoundTitles: [],
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
    notFoundTitles: [],
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

/**
 * Day 7 U: mock reach data for the fallback render. Five podcasts show
 * the full shelf; fewer people and brands show trimming; places are
 * empty with a real trace, demonstrating the no-data state (§10 #4).
 */
export const mockRelated: RelatedResult[] = [
  {
    kind: "podcast",
    items: [
      {
        entityId: "p01",
        name: "Deep Dive Podcast",
        kind: "podcast",
        affinityRank: 1,
        callId: "call-search-1",
      },
      {
        entityId: "p02",
        name: "Slow Burn Audio",
        kind: "podcast",
        affinityRank: 2,
        callId: "call-search-1",
      },
      {
        entityId: "p05",
        name: "Quiet Minds",
        kind: "podcast",
        affinityRank: 3,
        callId: "call-search-1",
      },
      {
        entityId: "p07",
        name: "Static Bloom",
        kind: "podcast",
        affinityRank: 4,
        callId: "call-search-1",
      },
      {
        entityId: "p08",
        name: "Night Signal",
        kind: "podcast",
        affinityRank: 5,
        callId: "call-search-1",
      },
    ],
    call: mockCalls[0],
  },
  {
    kind: "person",
    items: [
      {
        entityId: "pe01",
        name: "Mara Voss",
        kind: "person",
        affinityRank: 1,
        callId: "call-search-2",
      },
      {
        entityId: "pe02",
        name: "Jonas Feld",
        kind: "person",
        affinityRank: 2,
        callId: "call-search-2",
      },
      {
        entityId: "pe03",
        name: "Ayo Balogun",
        kind: "person",
        affinityRank: 3,
        callId: "call-search-2",
      },
      {
        entityId: "pe04",
        name: "Suki Tanaka",
        kind: "person",
        affinityRank: 4,
        callId: "call-search-2",
      },
    ],
    call: mockCalls[1],
  },
  {
    kind: "brand",
    items: [
      {
        entityId: "b01",
        name: "Field Notes",
        kind: "brand",
        affinityRank: 1,
        callId: "call-search-3",
      },
      {
        entityId: "b02",
        name: "Teenage Engineering",
        kind: "brand",
        affinityRank: 2,
        callId: "call-search-3",
      },
      {
        entityId: "b04",
        name: "Muji",
        kind: "brand",
        affinityRank: 3,
        callId: "call-search-3",
      },
    ],
    call: mockCalls[3],
  },
  {
    kind: "place",
    items: [],
    call: mockCalls[2],
  },
];

export const mockGaps: GapItem[] = [
  { tagId: "urn:tag:theme:media:solitude", label: "solitude", rank: 1 },
  { tagId: "urn:tag:mood:media:quiet", label: "quiet", rank: 2 },
  { tagId: "urn:tag:theme:media:grief", label: "grief", rank: 3 },
];

export const mockUnlabeledCount = 2;

/**
 * Day 8 U: mock change runs for eye-verifying every outcome state.
 * One accepted plus one withheld per failed condition (§10 #5).
 */
function mockChanged(
  failedCondition: ChangedRun["check"]["failedCondition"],
  after: number,
): ChangedRun {
  return {
    constraint: "Lower budget",
    proposedPitch:
      "A quiet science-fiction film, within lower budget: solitude.",
    usedGapLabels: ["solitude"],
    bar: { minRise: 0.05, requireControl: true },
    check:
      failedCondition === undefined
        ? { accepted: true, before: 0.61, after }
        : { accepted: false, failedCondition, before: 0.61, after },
    after:
      failedCondition === undefined
        ? {
            audienceId: "rival-lit",
            score: after,
            matchedTags: ["solitude", "slow-burn"],
            zeroTags: [],
            noDataTags: [],
          }
        : null,
    coverageAfter: 0.8,
    calls: [mockCalls[2]],
  };
}

export const mockChangedAccepted: ChangedRun = mockChanged(undefined, 0.72);

export const mockChangedWithheld: Record<string, ChangedRun> = {
  rise: mockChanged("rise", 0.62),
  coverage: mockChanged("coverage", 0.7),
  grounding: mockChanged("grounding", 0.7),
  control: mockChanged("control", 0.7),
};
