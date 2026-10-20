/**
 * Package B: rival audiences suggested by Qloo data. Owned by Q.
 *
 * The brief allows the LLM exactly two jobs (extract tags, word the
 * verdict), so rival candidates cannot come from a model's reading of
 * the pitch. They come from Qloo instead: ask Qloo which entities
 * over-index on the same things the pitch is about, and treat each
 * returned entity's fan base as one candidate audience.
 *
 * Verified live 2026-10-10: `signal.interests.tags` on `/v2/insights`
 * returns tag affinities (`concept.ts`), and the same signal with
 * `filter.type=urn:entity:<type>` returns ranked entities. Response
 * order is the rank (§11); nothing is sorted numerically here.
 *
 * Each rival is named after its lead Qloo entity, so the name is a
 * fact from Qloo — never a model's invention, and never a claim about
 * the audience. A rival with no lead entity is not built at all.
 *
 * Spec ref: §6.3 (rivals), §7 (Qloo supplies facts), §11 (ranks only),
 * §8 (one miss never fails the batch).
 */

import type { Audience, QlooCall, WorkType } from "../types.ts";
import { QlooError, qlooFetch } from "./client.ts";

/** Domain to Qloo entity type for the candidate fetch. */
export const WORK_TYPE_TO_ENTITY_TYPE: Record<WorkType, string> = {
  film: "urn:entity:movie",
  music: "urn:entity:artist",
  book: "urn:entity:book",
  game: "urn:entity:videogame",
};

/**
 * Extra domains a pitch's rivals may come from (v1 spec App. A: a quiet
 * sci-fi film also fits literary-fiction readers and ambient
 * listeners). One call per filter.type — comma-joined types 400 on the
 * hackathon API (verified live 2026-10-10), so never batch them.
 */
export const CROSS_DOMAIN_RIVALS: Record<WorkType, string[]> = {
  film: ["urn:entity:book", "urn:entity:artist"],
  music: ["urn:entity:movie", "urn:entity:book"],
  book: ["urn:entity:movie", "urn:entity:artist"],
  game: ["urn:entity:movie", "urn:entity:artist"],
};

/** Human label per entity type, so a rival says which domain it is from. */
const DOMAIN_LABELS: Record<string, string> = {
  "urn:entity:movie": "film fans",
  "urn:entity:artist": "music listeners",
  "urn:entity:book": "readers",
  "urn:entity:videogame": "players",
};

/** Rivals requested wide so post-trimming leaves enough real ones. */
const DISCOVERY_TAKE = "10";

/** Entities per rival audience: a lead plus relatives for signal. */
const ENTITIES_PER_RIVAL = 2;

/**
 * The signal discovery is asked with.
 *
 * - `tags`: "what work matches the pitch's matched words?" — the pitch
 *   words filtered to real Qloo tags, several at once.
 * - `entities`: "what work is related to the titles the user named?" —
 *   measured taste adjacency, one seed per title.
 *
 * They are different questions, and they fail for different reasons.
 * The tag question asks the graph for an intersection across every
 * matched word, so a niche pitch can come back empty even when the
 * catalog is full. The entity question asks for neighbours of works
 * that certainly exist. The agent tries one and falls back to the
 * other (see `shouldReplanWithEntities`).
 */
export type RivalSeed = "tags" | "entities";

export interface DiscoverRivalsInput {
  /** Where the seed came from: the pitch's tags or the named titles. */
  tagIds: string[];
  entityIds: string[];
  workType: WorkType;
  /** How many rival audiences to build in total. */
  count: number;
  /**
   * Which signal to prefer. Defaults to `tags` (the pitch's own words),
   * which is the sharper question when it works. The other signal is
   * used only when the preferred one has no data to send.
   */
  seed?: RivalSeed;
}

export interface DiscoverRivalsResult {
  rivals: Audience[];
  call: QlooCall | null;
  /** Domains a rival came from, parallel to `rivals` (same index). */
  domains: string[];
  /** Calls made, one per domain actually queried. */
  calls: QlooCall[];
  /**
   * Far-baseline candidate from the same live ranking: the last
   * bottom entity no built rival uses (own domain first, then cross
   * domains in query order), plus a second unused bottom entity for
   * signal when one exists. Null when every entity is used or no
   * domain returned any. Rivals keep building from the top exactly as
   * before — this only reads the leftovers, zero new calls.
   */
  farCandidate: FarCandidate | null;
  /**
   * The signal actually sent to the graph, or null when no call ran.
   * The agent needs this to know whether a second attempt would ask a
   * different question or the same one again.
   */
  seedUsed: RivalSeed | null;
  /**
   * True when at least one domain call got a real answer. An empty
   * result from an outage is not the same finding as an empty result
   * from a narrow question, and only the second one is worth re-asking.
   */
  answered: boolean;
}

/** One bottom entity (+ optional second) backing the far baseline. */
export interface FarCandidate {
  id: string;
  name: string;
  type: string;
  /** Second unused bottom entity for signal; null when none exists. */
  member: { id: string; name: string; type: string } | null;
}

interface EntityEntry {
  entity_id?: unknown;
  id?: unknown;
  name?: unknown;
}
function extractEntities(data: unknown): { id: string; name: string }[] {
  if (typeof data !== "object" || data === null) return [];
  const root = data as Record<string, unknown>;
  const results: unknown = root.results;
  let entries: unknown = [];
  if (Array.isArray(results)) entries = results;
  else if (typeof results === "object" && results !== null) {
    entries = (results as Record<string, unknown>).entities ?? [];
  }
  if (!Array.isArray(entries)) return [];
  const out: { id: string; name: string }[] = [];
  const seen = new Set<string>();
  for (const raw of entries) {
    if (typeof raw !== "object" || raw === null) continue;
    const e = raw as EntityEntry;
    const id = typeof e.entity_id === "string" ? e.entity_id : e.id;
    const name = typeof e.name === "string" ? e.name.trim() : "";
    if (typeof id !== "string" || id.trim() === "" || name === "") continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ id, name });
  }
  return out;
}

/**
 * Build up to `count` rival audiences from Qloo data, across domains.
 * Rivals spread over the pitch's own domain plus the cross-domain set,
 * so a film pitch can be read as a literary-fiction or music audience
 * rather than only as a movie-fan one (v1 spec App. A). Never throws: a
 * Qloo failure yields no rivals for that domain with its trace, which
 * the flow reports honestly (§8).
 */
export async function discoverRivals(
  input: DiscoverRivalsInput,
): Promise<DiscoverRivalsResult> {
  if (typeof window !== "undefined") {
    throw new Error("discoverRivals is server-only.");
  }
  const { tagIds, entityIds, workType, count } = input;
  const empty: DiscoverRivalsResult = {
    rivals: [],
    call: null,
    domains: [],
    calls: [],
    farCandidate: null,
    seedUsed: null,
    answered: false,
  };
  if (count <= 0) return empty;
  if (tagIds.length === 0 && entityIds.length === 0) return empty;

  // Which signal goes on the wire. The preferred one wins when it has
  // data to send; the other one is the fallback, so an attempt always
  // asks the graph something rather than nothing.
  const preferTags = (input.seed ?? "tags") === "tags";
  const useTagSignal = preferTags
    ? tagIds.length > 0
    : entityIds.length === 0 && tagIds.length > 0;
  const useEntitySignal = !useTagSignal && entityIds.length > 0;
  const seedUsed: RivalSeed | null = useTagSignal
    ? "tags"
    : useEntitySignal
      ? "entities"
      : null;

  // One call per filter.type (comma-joined types 400 live), then a
  // round-robin over the returned entities: each round takes its first
  // rival from a different domain, so a cross-domain reading is never
  // crowded out by the own domain's results.
  const ownType = WORK_TYPE_TO_ENTITY_TYPE[workType];
  const types = [
    ownType,
    ...(CROSS_DOMAIN_RIVALS[workType] ?? []).filter((t) => t !== ownType),
  ];
  const perDomain = new Map<
    string,
    { trace: QlooCall; entities: { id: string; name: string }[] }
  >();
  // A failure and an empty answer both arrive here as zero entities.
  // Remember which one it was, so the caller never re-asks a question
  // the graph never answered.
  let answered = false;
  for (const entityType of types) {
    const params: Record<string, string> = {
      "filter.type": entityType,
      take: DISCOVERY_TAKE,
    };
    if (useTagSignal) {
      // Every matched tag seeds discovery (at most TAG_WORDS.max = 8
      // ids, fine for one query string). Truncating to the first 5
      // made rival sets depend on LLM word order: identical titles
      // produced unrelated rivals (repeat probe 2026-10-12). Entity
      // ids stay capped — titles are unbounded user input (§11).
      params["signal.interests.tags"] = tagIds.join(",");
    } else if (useEntitySignal) {
      params["signal.interests.entities"] = entityIds.slice(0, 5).join(",");
    }
    try {
      const { data, trace } = await qlooFetch("/v2/insights", params);
      answered = true;
      perDomain.set(entityType, { trace, entities: extractEntities(data) });
    } catch (err) {
      if (err instanceof QlooError) {
        perDomain.set(entityType, { trace: err.trace, entities: [] });
      } else {
        throw err;
      }
    }
  }

  const rivals: Audience[] = [];
  const domains: string[] = [];
  const calls = [...perDomain.values()].map((d) => d.trace);
  const firstCall: QlooCall | null = calls[0] ?? null;

  for (let round = 0; rivals.length < count; round += 1) {
    let progressed = false;
    for (const [entityType, { entities }] of perDomain) {
      if (rivals.length >= count) break;
      const start = round * ENTITIES_PER_RIVAL;
      const lead = entities[start];
      if (lead === undefined) continue;
      const members = entities.slice(start + 1, start + ENTITIES_PER_RIVAL);
      rivals.push({
        id: `rival-${rivals.length + 1}`,
        kind: "rival",
        name: `Fans of ${lead.name}`,
        reason: DOMAIN_LABELS[entityType],
        titles: [lead, ...members].map((m) => ({
          query: m.name,
          qlooId: m.id,
          name: m.name,
          type: entityType,
        })),
        notFoundTitles: [],
      });
      domains.push(entityType);
      progressed = true;
    }
    if (!progressed) break;
  }

  // Far baseline from the leftovers: bottom-up unused entities, own
  // domain first (perDomain already inserts the own type first), then
  // cross domains in query order. Deterministic, zero new calls.
  const usedIds = new Set<string>();
  for (const rival of rivals) {
    for (const title of rival.titles) usedIds.add(title.qlooId);
  }
  const unusedBottom: { id: string; name: string; type: string }[] = [];
  for (const [entityType, { entities }] of perDomain) {
    for (let index = entities.length - 1; index >= 0; index -= 1) {
      const entity = entities[index];
      if (entity !== undefined && !usedIds.has(entity.id)) {
        unusedBottom.push({
          id: entity.id,
          name: entity.name,
          type: entityType,
        });
      }
    }
  }
  const [lead, member] = [unusedBottom[0], unusedBottom[1] ?? null];
  const farCandidate: FarCandidate | null =
    lead === undefined
      ? null
      : { id: lead.id, name: lead.name, type: lead.type, member };

  return {
    rivals,
    call: firstCall,
    domains,
    calls,
    farCandidate,
    seedUsed,
    answered,
  };
}

/**
 * Should the agent ask the second question?
 *
 * The tag question ("what work matches all of the pitch's words?") is
 * an intersection, and an intersection across eight adjectives is
 * empty for most niche pitches — not because the catalog is missing
 * work, but because the question is too narrow. The entity question
 * ("what is related to the titles you named?") asks for neighbours of
 * works that certainly exist, and it comes back with rivals.
 *
 * So: when the tag question answered and returned nothing, and the user
 * named titles, the agent re-asks the graph from the titles. Pure, so
 * the decision is unit-tested without any network call.
 *
 * Deliberately narrow. A partial result is a real result (Qloo returned
 * fewer rivals than asked for — the spec allows that), so only an
 * empty one counts as a failed plan. And a failure is not an empty
 * answer: re-asking an outage spends three more calls and then reports
 * that the graph found nothing, which it never said. One extra
 * attempt, then the run says honestly that no rival audience exists.
 */
export function shouldReplanWithEntities(input: {
  /** Rivals the first attempt produced. */
  rivalsFound: number;
  /** The signal the first attempt actually sent. */
  seedUsed: RivalSeed | null;
  /** How many entity ids are available to re-seed with. */
  entityCount: number;
  /** False when no first-attempt call got an answer at all. */
  firstAttemptAnswered: boolean;
}): boolean {
  if (input.rivalsFound > 0) return false;
  // An outage is not a finding. The step already says "Qloo did not
  // answer"; a second question would not either.
  if (!input.firstAttemptAnswered) return false;
  // Already asked the entity question: re-asking would repeat it.
  if (input.seedUsed !== "tags") return false;
  // Nothing to re-seed with. The user named no titles that resolved.
  return input.entityCount > 0;
}
