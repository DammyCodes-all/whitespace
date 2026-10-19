/**
 * Demo harness fetch: answers every route OrbFlow calls from fixtures,
 * so the full flow (entry → tags → titles → aggregate → run → results)
 * runs with zero AI and zero Qloo calls. Unknown routes pass through
 * to the real fetch untouched.
 *
 * Delays are stagecraft, not measurement: they let each morph beat
 * read before its receipt lands. Kept deliberately slow (review pace)
 * so each leg can be watched end to end before judging it.
 * node --test compatible for the
 * mapper; the window shim lives behind installDemoFetch.
 */

import { namedAudienceLabel } from "../audience-words.ts";
import {
  DEMO_CHANGE_ACCEPTED,
  DEMO_CHATBOT,
  DEMO_FLOW_RESULT,
  DEMO_FLOW_TAGS,
} from "./design-system-data.ts";

export interface DemoPayload {
  status: number;
  delayMs: number;
  json: unknown;
}

interface TitlesCheckBody {
  titles?: unknown;
  workType?: unknown;
}

interface TitlesTagsBody {
  titles?: unknown;
}

interface PickBody {
  candidates?: unknown;
}

interface RelatedBody {
  excludeNames?: unknown;
}

interface FlowBody {
  pitchText?: unknown;
  workType?: unknown;
}

const GIFTS = [
  {
    qlooId: "demo-gift-1",
    label: "slow-burn",
    sourceTitleId: "demo-title-0",
    sourceTitleName: "Demo",
  },
  {
    qlooId: "demo-gift-2",
    label: "solitude",
    sourceTitleId: "demo-title-0",
    sourceTitleName: "Demo",
  },
];

const SUGGESTION_POOL = ["Moon", "Arrival", "Blade Runner 2049"];

const RUN_STEPS = [
  {
    id: "tags",
    label: "Your words, plus tags from your titles",
    status: "done",
    detail: "4 pooled (3 from pitch, 1 gift)",
  },
  {
    id: "audiences",
    label: namedAudienceLabel("film"),
    status: "done",
    detail: "1 checked, 1 found, 0 not found",
  },
  {
    id: "rivals",
    label: "Rival readings",
    status: "done",
    detail: "2 rivals from demo data",
  },
  {
    id: "verdict",
    label: "The verdict",
    status: "done",
    detail: "Strong, clears strangers by 39 points",
  },
];

function asStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (t): t is string => typeof t === "string" && t.trim() !== "",
  );
}

function asString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() !== "" ? value : fallback;
}

/** Pure mapper: route + parsed body in, canned payload out, null to pass through. */
export function demoResponseFor(
  pathname: string,
  body: unknown,
): DemoPayload | null {
  const b = (body ?? {}) as Record<string, unknown>;
  switch (pathname) {
    case "/api/tags":
      return {
        status: 200,
        delayMs: 1400,
        json: { tags: DEMO_FLOW_TAGS, workType: "film" },
      };
    case "/api/titles/check": {
      const titles = asStrings((b as TitlesCheckBody).titles);
      return {
        status: 200,
        delayMs: 1400,
        json: {
          resolved: titles.map((t, i) => ({
            query: t,
            name: t,
            qlooId: `demo-title-${i}`,
          })),
          notFound: [],
        },
      };
    }
    case "/api/titles/tags": {
      const names = asStrings((b as TitlesTagsBody).titles);
      const first = names[0] ?? "Demo";
      return {
        status: 200,
        delayMs: 1100,
        json: {
          tags: GIFTS.map((g) => ({ ...g, sourceTitleName: first })),
          note: "ok",
        },
      };
    }
    case "/api/titles/pick": {
      const candidates = b as PickBody;
      const ids = Array.isArray(candidates.candidates)
        ? candidates.candidates
            .map((c) =>
              typeof c === "object" && c !== null
                ? (c as { qlooId?: unknown }).qlooId
                : undefined,
            )
            .filter((id): id is string => typeof id === "string" && id !== "")
        : [];
      // Demo trains the live contract, tempering included: ids the
      // model never offers read as un-fit, never as a pass failure,
      // so a demo cut looks like a real one.
      return { status: 200, delayMs: 1000, json: { keptIds: ids } };
    }
    case "/api/titles/related": {
      const excluded = new Set(
        asStrings((b as RelatedBody).excludeNames).map((s) => s.toLowerCase()),
      );
      return {
        status: 200,
        delayMs: 1100,
        json: {
          suggestions: SUGGESTION_POOL.filter(
            (s) => !excluded.has(s.toLowerCase()),
          ),
        },
      };
    }
    case "/api/flow": {
      const flow = b as FlowBody;
      return {
        status: 200,
        delayMs: 2600,
        json: {
          result: {
            ...DEMO_FLOW_RESULT,
            pitch: asString(flow.pitchText, DEMO_FLOW_RESULT.pitch),
            type:
              flow.workType === "film" ||
              flow.workType === "music" ||
              flow.workType === "book" ||
              flow.workType === "game"
                ? flow.workType
                : DEMO_FLOW_RESULT.type,
          },
          steps: RUN_STEPS,
          stopped: false,
        },
      };
    }
    case "/api/compare":
      return {
        status: 200,
        delayMs: 1600,
        json: { chatbot: DEMO_CHATBOT, error: null, calls: [] },
      };
    case "/api/flow/change":
      return {
        status: 200,
        delayMs: 1400,
        json: { changed: DEMO_CHANGE_ACCEPTED },
      };
    default:
      return null;
  }
}

function readBody(init: RequestInit | undefined): unknown {
  try {
    return init?.body === undefined || typeof init.body !== "string"
      ? {}
      : (JSON.parse(init.body) as unknown);
  } catch {
    return {};
  }
}

/** Swaps window.fetch for the harness; returns a restore function. */
export function installDemoFetch(): () => void {
  if (typeof window === "undefined") return () => {};
  const real = window.fetch.bind(window);
  window.fetch = (async (
    input: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> => {
    let pathname: string;
    try {
      pathname = new URL(
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url,
        window.location.origin,
      ).pathname;
    } catch {
      return real(input, init);
    }
    const hit = demoResponseFor(pathname, readBody(init));
    if (hit === null) return real(input, init);
    await new Promise((res) => setTimeout(res, hit.delayMs));
    return new Response(JSON.stringify(hit.json), {
      status: hit.status,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof window.fetch;
  return () => {
    window.fetch = real;
  };
}
