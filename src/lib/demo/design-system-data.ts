/**
 * Design-system showcase data. Dev-only, server-safe.
 *
 * This page exists so the look in docs/design-direction.md can be checked
 * against real renders instead of imagined ones. Every value here is a
 * fixture: nothing in this file touches Qloo or the LLM, and nothing it
 * renders may pass for a live run (design-direction.md §6).
 *
 * Existing mock fixtures are reused rather than copied, so the showcase
 * and the /run skeleton cannot drift apart. Audience ids still double as
 * keys into src/lib/fixtures/taste-lists.ts (see mock-run.ts).
 */

import type { ChatbotView } from "@/components/chatbot-preview";
import type { EvidenceLine } from "@/components/evidence";
import type { Suggestion } from "@/components/pitch-form-utils";
import type { ProposeRival } from "@/lib/agent/propose";
import {
  mockAudiences,
  mockChangedAccepted,
  mockChangedWithheld,
  mockGaps,
  mockInput,
  mockRelated,
  mockScores,
  mockSteps,
  mockUnlabeledCount,
  mockVerdict,
} from "@/lib/demo/mock-run";
import type { FlowEvidence, FlowResult, FlowTag } from "@/lib/flow/contract";
import type { ChangedRun } from "@/lib/pipeline/change";
import type { RelatedResult } from "@/lib/qloo/related";
import type {
  Audience,
  QlooCall,
  RunStep,
  VerdictResult,
  WorkType,
} from "@/lib/types";

/* ─────────────────────────────────────────────────────────
 * Tokens, restated for the swatch grid.
 * Values are copied from src/app/globals.css :root. If a token
 * changes there, change it here — the swatch is the proof.
 * ───────────────────────────────────────────────────────── */

export interface Swatch {
  name: string;
  value: string;
  note: string;
  /** Text color used for the label chip on top of the swatch. */
  on: "ink" | "paper";
}

export const NEUTRAL_SWATCHES: Swatch[] = [
  { name: "paper", value: "#F7F7F4", note: "canvas", on: "ink" },
  { name: "surface", value: "#FFFFFF", note: "cards", on: "ink" },
  { name: "outline", value: "#17151F", note: "2px borders", on: "paper" },
  { name: "rule", value: "#E9DEC6", note: "hairlines only", on: "ink" },
  { name: "ink", value: "#17151F", note: "16.8:1 on paper", on: "paper" },
  { name: "ink-2", value: "#4A4658", note: "8.5:1 secondary", on: "paper" },
  {
    name: "ink-3",
    value: "#625E75",
    note: "5.8:1 text floor",
    on: "paper",
  },
];

export const VERDICT_SWATCHES: Swatch[] = [
  {
    name: "strong",
    value: "#5FE3A1",
    note: "mint · 11.2:1 with ink",
    on: "ink",
  },
  { name: "split", value: "#FFCB3D", note: "yellow · 11.9:1", on: "ink" },
  { name: "weak", value: "#C4D8F5", note: "soft blue · 12.5:1", on: "ink" },
  { name: "surprise", value: "#FF6B4A", note: "coral · 6.4:1", on: "paper" },
];

export const TEXT_SAFE_SWATCHES: Swatch[] = [
  {
    name: "measured",
    value: "#0A6B47",
    note: "6.1:1 on paper — measurement only",
    on: "paper",
  },
  {
    name: "split-ink",
    value: "#8A5A00",
    note: "5.5:1 on paper — verdict as text",
    on: "paper",
  },
];

export const ABSENCE_SWATCHES: Swatch[] = [
  {
    name: "nodata-bg",
    value: "#EEECE6",
    note: "hatch base · 5.3:1",
    on: "ink",
  },
  {
    name: "nodata-hatch",
    value: "#C9C6BC",
    note: "45° lines, 1px/4px",
    on: "ink",
  },
  {
    name: "clay",
    value: "#8A4B2D",
    note: "6.3:1 · not found only",
    on: "paper",
  },
];

/* ─────────────────────────────────────────────────────────
 * Type specimens (design-direction.md §4).
 * ───────────────────────────────────────────────────────── */

export interface TypeSpecimen {
  role: string;
  font: string;
  sample: string;
  usage: string;
  className: string;
}

export const TYPE_SPECIMENS: TypeSpecimen[] = [
  {
    role: "Headline",
    font: "Bricolage Grotesque",
    sample: "Where the pitch lands.",
    usage:
      "Headlines, the verdict sentence, audience names, the case-page title. Weights 600–800 at 28px and up, tight leading.",
    className: "font-serif text-3xl leading-tight tracking-tight text-ink",
  },
  {
    role: "Body",
    font: "Figtree",
    sample:
      "A quiet science-fiction film about a lonely worker on a space station.",
    usage:
      "All UI and body text, 15 to 16px, leading around 1.5, measure capped near 68ch.",
    className: "text-body text-ink-2",
  },
  {
    role: "Mono number",
    font: "IBM Plex Mono",
    sample: "0.72  ·  0.61  ·  0.44",
    usage:
      "Every number that moves while a run streams, coverage fractions, raw Qloo payloads. Tabular figures so nothing jitters.",
    className: "tnum font-mono text-sm text-ink",
  },
  {
    role: "Label",
    font: "IBM Plex Mono",
    sample: "hypothesis audience · §6.2",
    usage: "Eyebrow labels and section keys, 11–13px, ink-3.",
    className: "font-mono text-xs tracking-tight text-ink-3",
  },
];

/* ─────────────────────────────────────────────────────────
 * Run steps, in every status so the three frames are visible.
 * ───────────────────────────────────────────────────────── */

/**
 * Run steps, in every status so the three frames are visible.
 *
 * Their citations are remapped to the calls listed in the evidence
 * section on this page, so a step's dot really opens the call it
 * claims (§6.12) — a citation that goes nowhere is worse than none.
 */
const STEP_CALL_IDS: Record<string, string> = {
  "call-search-1": "ds-call-search-1",
  "call-search-2": "ds-call-related-1",
  "call-insights-1": "ds-call-tastes-2",
  "call-search-3": "ds-call-related-3",
};

function demoSteps(kind: "pending" | "active"): RunStep[] {
  return mockSteps.map((step, i) => ({
    ...step,
    status:
      kind === "pending"
        ? "pending"
        : i < 2
          ? "done"
          : i === 2
            ? "active"
            : "pending",
    detail: kind === "active" && i < 2 ? step.detail : undefined,
    callId:
      step.callId === undefined
        ? undefined
        : (STEP_CALL_IDS[step.callId] ?? step.callId),
  }));
}

export const DEMO_STEPS_PENDING: RunStep[] = demoSteps("pending");

export const DEMO_STEPS_ACTIVE: RunStep[] = demoSteps("active");

/* ─────────────────────────────────────────────────────────
 * Verdict variants, so every word and fill is on the page at once.
 * ───────────────────────────────────────────────────────── */

const baseVerdict: VerdictResult = mockVerdict;

export const DEMO_VERDICTS: {
  label: string;
  verdict: VerdictResult;
}[] = [
  { label: "Strong · surprise", verdict: baseVerdict },
  {
    label: "Strong · no surprise",
    verdict: { ...baseVerdict, surprise: false },
  },
  {
    label: "Mixed · clears control",
    verdict: {
      ...baseVerdict,
      verdict: "Mixed",
      marginTopVsSecond: 0.04,
      clearsControl: true,
      surprise: false,
    },
  },
  {
    label: "Weak · misses control",
    verdict: {
      ...baseVerdict,
      verdict: "Weak",
      marginTopVsSecond: 0.09,
      marginTopVsControl: -0.12,
      clearsControl: false,
      surprise: false,
    },
  },
  {
    label: "Inconclusive · abstains",
    verdict: {
      ...baseVerdict,
      verdict: "Inconclusive",
      topAudienceId: null,
      marginTopVsSecond: 0,
      marginTopVsControl: 0,
      clearsControl: false,
      surprise: false,
      inconclusiveReason: "nodata",
    },
  },
];

/* ─────────────────────────────────────────────────────────
 * A whole FlowResult, so FlowResultView renders for real.
 * Numbers here are fixtures: the adapter is what nulls an
 * unjudgeable score, and this object keeps one null to prove it.
 * ───────────────────────────────────────────────────────── */

export const DEMO_FLOW_TAGS: FlowTag[] = [
  {
    label: "slow-burn",
    qlooId: "urn:tag:genre:media:slow_burn",
    status: "matched",
  },
  { label: "space", qlooId: "urn:tag:theme:media:space", status: "matched" },
  {
    label: "solitude",
    qlooId: "urn:tag:theme:media:solitude",
    status: "matched",
  },
  { label: "loneliness", status: "not_found" },
];

export const DEMO_FLOW_RESULT: FlowResult = {
  pitch: mockInput.pitchText,
  type: "film",
  tags: DEMO_FLOW_TAGS,
  audiences: [
    {
      id: "hyp",
      name: "Slow science-fiction",
      role: "named",
      score: 0.61,
      tagHits: ["slow-burn", "space"],
      evidenceId: "ds-call-tastes-1",
    },
    {
      id: "rival-lit",
      name: "Literary fiction about isolation",
      role: "rival",
      score: 0.72,
      tagHits: ["solitude", "slow-burn"],
      evidenceId: "ds-call-tastes-2",
    },
    {
      id: "rival-amb",
      name: "Ambient music listeners",
      role: "rival",
      score: 0.44,
      tagHits: ["quiet"],
      evidenceId: "ds-call-tastes-3",
    },
    {
      id: "control-1",
      name: "Control · fast franchise action",
      role: "control",
      score: null,
      tagHits: [],
      evidenceId: null,
    },
    {
      id: "control-2",
      name: "Control · reality TV",
      role: "control",
      score: 0.33,
      tagHits: [],
      evidenceId: "ds-call-tastes-4",
    },
  ],
  ceiling: 0.33,
  verdict: "strong",
  surprise: true,
  reach: [
    {
      audienceId: "rival-lit",
      audienceName: "Literary fiction about isolation",
      interests: [
        { name: "solitude", rank: 1, evidenceId: "ds-call-tastes-2" },
        { name: "quiet", rank: 2, evidenceId: "ds-call-tastes-2" },
        { name: "grief", rank: 3, evidenceId: "ds-call-tastes-2" },
      ],
      people: [
        { name: "Mara Voss", rank: 1, evidenceId: "ds-call-related-1" },
        { name: "Jonas Feld", rank: 2, evidenceId: "ds-call-related-1" },
      ],
      podcasts: [
        { name: "Deep Dive Podcast", rank: 1, evidenceId: "ds-call-related-2" },
        { name: "Slow Burn Audio", rank: 2, evidenceId: "ds-call-related-2" },
      ],
      brands: [
        { name: "Field Notes", rank: 1, evidenceId: "ds-call-related-3" },
      ],
      places: [],
    },
  ],
  evidence: {},
  qlooCalls: { network: 2, cached: 9, total: 11 },
};

/* ─────────────────────────────────────────────────────────
 * Calls and evidence. responseBody is set so the evidence
 * drawer shows a real payload instead of "not captured";
 * ids are prefixed ds- so they never collide with the
 * fixture ids used by the rest of the page.
 * ───────────────────────────────────────────────────────── */

const AT = new Date().toISOString();

export const DEMO_CALLS: QlooCall[] = [
  {
    id: "ds-call-search-1",
    endpoint: "/search",
    method: "GET",
    params: { query: "Moon", types: "urn:entity:movie" },
    status: 200,
    durationMs: 212,
    at: AT,
    fromCache: true,
    responseBody:
      '{"results":[{"id":"moon-id","name":"Moon","type":"urn:entity:movie"}]}',
    responseTruncated: false,
  },
  {
    id: "ds-call-tastes-1",
    endpoint: "/v2/insights",
    method: "GET",
    params: { "signal.interests.entities": "moon-id" },
    status: 200,
    durationMs: 298,
    at: AT,
    fromCache: true,
    responseBody:
      '{"entities":[{"tags":[{"tagId":"urn:tag:genre:media:slow_burn","rank":1}]}]}',
    responseTruncated: false,
  },
  {
    id: "ds-call-tastes-2",
    endpoint: "/v2/insights",
    method: "GET",
    params: { "signal.interests.entities": "nlmg-id" },
    status: 200,
    durationMs: 342,
    at: AT,
    fromCache: false,
    responseBody:
      '{"entities":[{"tags":[{"tagId":"urn:tag:theme:media:solitude","rank":1}]}]}',
    responseTruncated: false,
  },
  {
    id: "ds-call-tastes-3",
    endpoint: "/v2/insights",
    method: "GET",
    params: { "signal.interests.entities": "eno-id" },
    status: 200,
    durationMs: 264,
    at: AT,
    fromCache: false,
    responseBody:
      '{"entities":[{"tags":[{"tagId":"urn:tag:mood:media:quiet","rank":2}]}]}',
    responseTruncated: false,
  },
  {
    id: "ds-call-tastes-4",
    endpoint: "/v2/insights",
    method: "GET",
    params: { "signal.interests.entities": "reality-tv-id" },
    status: 200,
    durationMs: 201,
    at: AT,
    fromCache: false,
    responseBody:
      '{"entities":[{"tags":[{"tagId":"urn:tag:genre:media:reality","rank":1}]}]}',
    responseTruncated: false,
  },
  {
    id: "ds-call-related-1",
    endpoint: "/v2/insights",
    method: "GET",
    params: { "signal.interests.entities": "nlmg-id", filter: "person" },
    status: 200,
    durationMs: 245,
    at: AT,
    fromCache: false,
    responseBody:
      '{"results":[{"id":"pe01","name":"Mara Voss","affinity_rank":1}]}',
    responseTruncated: false,
  },
  {
    id: "ds-call-related-3",
    endpoint: "/v2/insights",
    method: "GET",
    params: { "signal.interests.entities": "nlmg-id", filter: "brand" },
    status: 200,
    durationMs: 233,
    at: AT,
    fromCache: false,
    responseBody:
      '{"results":[{"id":"b01","name":"Field Notes","affinity_rank":1}]}',
    responseTruncated: false,
  },
  {
    id: "ds-call-related-2",
    endpoint: "/v2/insights",
    method: "GET",
    params: { "signal.interests.entities": "nlmg-id", filter: "podcast" },
    status: 200,
    durationMs: 288,
    at: AT,
    fromCache: false,
    responseBody:
      '{"results":[{"id":"p01","name":"Deep Dive Podcast","affinity_rank":1}]}',
    responseTruncated: false,
  },
  {
    id: "ds-call-rate-limited",
    endpoint: "/v2/insights",
    method: "GET",
    params: { "signal.interests.entities": "eno-id" },
    status: 429,
    durationMs: 61,
    at: AT,
    fromCache: false,
    responseSummary: "429 — quota window exhausted; retry after 30s",
  },
];

DEMO_FLOW_RESULT.evidence = Object.fromEntries(
  DEMO_CALLS.filter((c) => c.id !== "ds-call-rate-limited").map((c) => [
    c.id,
    {
      request: { endpoint: c.endpoint, params: { ...c.params } },
      response: c.responseBody ?? c.responseSummary ?? "not captured",
      truncated: c.responseTruncated ?? c.responseBody === undefined,
      status: c.status,
      fromCache: c.fromCache,
    } satisfies FlowEvidence,
  ]),
);

export const DEMO_EVIDENCE_LINES: EvidenceLine[] = [
  {
    text: "Best fit: Literary fiction about isolation, 0.72.",
    callId: "ds-call-tastes-2",
  },
  { text: "Moon resolved in Qloo as a film.", callId: "ds-call-search-1" },
  { text: "Deep Dive Podcast ranks first for that audience." },
];

/* ─────────────────────────────────────────────────────────
 * Confirm-step and input fixtures.
 * ───────────────────────────────────────────────────────── */

export const DEMO_TAG_CHIPS: FlowTag[] = DEMO_FLOW_TAGS;

export const DEMO_SUGGESTIONS: Suggestion[] = [
  { key: "ai-moon", name: "Moon" },
  { key: "ai-arrival", name: "Arrival" },
  { key: "ai-solaris", name: "Solaris" },
];

export const DEMO_WORDS: string[] = [
  "science-fiction",
  "space",
  "drama",
  "future",
  "solitude",
];

export const DEMO_PINNED: string[] = ["solitude"];

export const DEMO_RIVALS: ProposeRival[] = [
  {
    id: "rival-lit",
    name: "Literary fiction about isolation",
    reason: "Reads the station as solitude, not spectacle.",
    titles: ["Never Let Me Go", "Klara and the Sun", "Station Eleven"],
  },
  {
    id: "rival-amb",
    name: "Ambient music listeners",
    reason: "Reads the quiet as the point, not the setting.",
    titles: ["Brian Eno", "Stars of the Lid", "Tim Hecker"],
  },
];

export const DEMO_NOTHING_LIKE: string[] = ["Fast franchise action"];

export const DEMO_AUDIENCE: Audience = mockAudiences[0];

export const DEMO_WORK_TYPES: WorkType[] = ["film", "music", "book", "game"];

/** Chatbot answer with every title checked (§6.11). */
export const DEMO_CHATBOT: ChatbotView = {
  answer:
    "This is clearly for fans of Interstellar, Arrival and Moon. Ambient listeners like Brian Eno are the second-best crowd, and a poster campaign on BookTok should carry it.",
  found: [
    {
      query: "Interstellar",
      qlooId: "interstellar-id",
      name: "Interstellar",
      type: "urn:entity:movie",
    },
    {
      query: "Arrival",
      qlooId: "arrival-id",
      name: "Arrival",
      type: "urn:entity:movie",
    },
    {
      query: "Moon",
      qlooId: "moon-id",
      name: "Moon",
      type: "urn:entity:movie",
    },
  ],
  notFoundTitles: ["BookTok"],
};

/**
 * Reach plan and change, both rebuilt against the calls listed in the
 * evidence section so every shelf citation resolves (§6.12).
 */
export const DEMO_REACH_AUDIENCE: Audience = mockAudiences[0];

export const DEMO_RELATED: RelatedResult[] = mockRelated.map((group) => {
  const callId =
    group.kind === "podcast"
      ? "ds-call-related-2"
      : group.kind === "person"
        ? "ds-call-related-1"
        : group.kind === "brand"
          ? "ds-call-related-3"
          : "ds-call-search-1";
  return {
    ...group,
    items: group.items.map((item) => ({ ...item, callId })),
  };
});

export const DEMO_GAPS = mockGaps;
export const DEMO_UNLABELED_COUNT = mockUnlabeledCount;
export const DEMO_PITCH_TEXT = mockInput.pitchText;
export const DEMO_MOCK_AUDIENCES = mockAudiences;
export const DEMO_MOCK_SCORES = mockScores;
export const DEMO_MOCK_VERDICT = mockVerdict;

/** The recheck's citation, rebuilt against the calls on this page. */
export const DEMO_CHANGE_ACCEPTED: ChangedRun = {
  ...mockChangedAccepted,
  calls: [DEMO_CALLS.find((c) => c.id === "ds-call-tastes-2") ?? DEMO_CALLS[0]],
};

export const DEMO_CHANGE_WITHHELD: {
  label: string;
  changed: (typeof mockChangedWithheld)[string];
}[] = [
  { label: "rise — not enough improvement", changed: mockChangedWithheld.rise },
  {
    label: "coverage — speaks to fewer words",
    changed: mockChangedWithheld.coverage,
  },
  {
    label: "grounding — words not in Qloo",
    changed: mockChangedWithheld.grounding,
  },
  { label: "control — lost the lead", changed: mockChangedWithheld.control },
];

/* Saved-run store entry: SavedRunPanel renders nothing until one exists. */
export const DEMO_SAVED_PITCH = DEMO_PITCH_TEXT;
