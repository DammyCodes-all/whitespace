# V2 implementation: findings log

Date: 2026-10-10. Proposal: `docs/pipeline-redesign.md` (v2, adopted).
Current behavior is defined by `docs/product-spec.md`. Earlier cut decisions below are historical: supporting retrieval, reach, comparison overlay, bounded enrichment, and client-side replay have since landed. Review hardening is recorded in `docs/v2-review.md`.
Raw Qloo payloads are never stored in this repo (hackathon guide: private
caching only). Everything below is aggregates and conclusions.

## 1. What the proposal asks for

Replace the reasoning model, not the product purpose: from "which
LLM-preselected audience scores highest on pitch tags" to "what taste
connections exist around the idea's distinct aspects, and which audience
hypotheses do they support". Taste neighborhoods are code-built from
returned entities; the LLM only interprets, proposes analogies, and
explains frozen evidence. No fit percentages, no Strong/Split/Weak, no
per-run controls, no exclusion subtraction, no Concept self-scoring.

## 2. Capability pilot (live, 10 calls, §8 gate)

Resolve 2 film lenses via `/search` (exact-name match won every time;
hits carried no usable type info, so first-hit acceptance is out), then
`GET /v2/insights` with entity signals into movies + books at top-20.
Pairs: Interstellar×Moonlight, Interstellar×Dune, Interstellar×BR2049,
Her×Moonlight. Depth sweep 20/50/100; exclude-filter, book-seeded
podcast/person reach, unknown-param, and repeat-stability checks.

- Discovery works: 20/20 movies and books with metadata (tags on
  18–20/20), take honored at 20 and 50. `take=100` returns zero —
  practical page cap is ~50.
- **Overlap is 0 at top-20 in every pair × category, including near
  pairs, and still 0 at take=50.** Shared tag vocabulary is large but
  generic (~900–1300 of ~3500–4200). Repeat queries are deterministic.
- `filter.exclude.entities` honored; unknown params silently ignored
  (200s prove nothing by themselves); book-seeded podcast/person reach
  works (5/5); artist fallback returns 20/20 with tags.

Gate verdict: entity-overlap grouping will usually yield zero supported
neighborhoods. Per §8 the honest first release is reference-led
exploration. Recorded in `docs/qloo-coverage.md` (V2 capability pilot).

## 3. Inefficiencies flagged and agreed cuts

- 40-attempt ceiling / ~24-call typical path is heavy for a 90s budget
  and mostly lands on exploration-only → lean MVP defers supporting
  lens, reach, detail enrichment, and comparison overlay.
- Detail enrichment before proving metadata need → deferred.
- `POST /api/analyze` + server replay store → removed; client-side
  persistence of the versioned `V2Result` instead.
- Metadata-label grouping before knowing tag quality → lean does
  overlap-only with reference-overlap fallback, no LLM gap-filling.
- Jaccard 0.6, top-20, ≤3 neighborhoods kept as versioned heuristics,
  not findings.

Agreed: pilot-first, side-by-side (`src/lib/pipeline/v2/`, v1 frozen),
lean MVP, no server replay.

## 4. What landed (Phase 0 + Phase 1 + Phase 2a/2b + orchestrator)

- `docs/qloo-coverage.md`: pilot aggregates + lean-MVP decision.
- `src/lib/pipeline/v2/types.ts`: lean contracts — brief, lenses with
  separate identity/bridge facts, frozen manifest, retrievals with
  id+name together, neighborhoods with C/X counts, bounded
  explorations, report/data states, budgets, versions. Leads deferred
  as `never[]` + limitation note. `confirmedAnalogies` upgrades
  bridges to creator-confirmation (correction UI to follow).
- `src/lib/pipeline/v2/discovery.ts`: seed exclusion, ≥2-lens cores
  (retries count once), family-collapse flag, one-candidate grouping
  with shared-descriptor coherence, C-then-X ordering with stable-id
  ties, Jaccard dedupe, bounded explorations.
- `src/lib/pipeline/v2/assess.ts`: §5 state table (lean subset).
- `src/lib/qloo/v2-identity.ts`: exact name/alias match in-type wins;
  multi-match is ambiguous (year/disambiguation surfaced, never
  picked); fuzzy-only is not-found; request failures and budget
  exhaustion fail closed. Hit tag ids reused for bridge support, no
  extra call.
- `src/lib/qloo/v2-evidence.ts`: fixed-take typed discovery queries,
  server + local seed exclusion, normalized entities with positions,
  ok/empty/failed separation, concurrent categories, shared budget.
- `src/lib/agent/v2-brief.ts`: JSON-only brief + ≤2 candidates per
  aspect; excerpts code-checked as exact pitch substrings; no invented
  genre (zero aspects + unrepresentable note); one structured repair.
- `src/lib/pipeline/v2/run.ts` + `wiring.ts`: `analyzePitch` owns
  scope → interpret → resolve → freeze → retrieve → group → assess,
  with frozen manifest, request-scoped budget (40 ceiling), 90s
  deadline with cooperative stop, real progress stages, and client-
  persistable `V2Result` (no server replay).
- `src/lib/fixtures/v2-synthetic.ts`: labeled-synthetic fixtures
  (shared / sparse / provisional / partial).
- Tests: 52 v2 (discovery 18, identity 12, brief 7, orchestrator 15).

Verify: biome+tsc clean on new files; node24 52/52 v2 and 176/176
full suite; `next build` passes. Full-repo `pnpm check` failure is
pre-existing (`api.js`, `postcss.config.mjs`), untouched.

## 5. Capability verdict (2026-10-10, after artist follow-up)

Probed artist-category overlap for the same pairs (4 calls, aggregates
only): Interstellar×Dune share **5/20 artists**, Her×Moonlight share
0/20. The 5 shared artists are all film-score composers with 41–91
returned tags each — a genuinely coherent neighborhood, not generic
contamination — and identical popularity values across both queries
confirm deterministic catalog data. The far pair sharing nothing is
the desired discrimination behavior.

Stage-by-stage: A (brief) logically tested, live LLM quality still
unevaluated — needs human pitch-pack review. B (identity) verified
live, ambiguity included. C/D (freeze/retrieve) verified: full pages,
rich tags, honored excludes, deterministic repeats. E (grouping) is
real in artist space, absent in movie/book space at depth ≤50. F
(counts/ordering) tested pure; live C/X now plausible once bridges
are confirmed. G (reach) verified from book seeds. H (explanation)
not built.

Bottom line: the pipeline works end to end, with one
proposal-sanctioned correction — §4D names artists as fallback "if
testing shows books are insufficient", and testing has shown exactly
that. The discovery pair for the film pilot should be
movie+artist, not movie+book. Expectation to set: hypotheses fire
only when lenses genuinely share taste space *and* bridges are
creator-confirmed; otherwise honest exploration-only. Product value
of exploration mode is still unvalidated with humans.

## 6. Next (Phase 3+) — landed 2026-10-10

- `POST /api/analyze` returns `V2Result` directly (validated raw
  input, no server store); client (`v2-store.ts`) persists by runId,
  refresh replays without re-running.
- `/analyze` page: idea-only form, honest pending note, interpretation
  + reference lenses as prepared, evidence counts, explorations,
  limitations. Confirm-analogy re-runs a new version with
  `confirmedAnalogies`; revise-pitch re-runs with `correctionOf`.
- Live smoke (space-station pitch): 200 in ~15s,
  exploration-only/complete, 3 aspects with exact excerpts, one
  ambiguous lens correctly held back (Moon), two resolved
  (provisional), 9 attempts of 40.
- Still owed: human pitch-pack evaluation, latency/attempt
  instrumentation across runs, spec-delta adoption decision.

## 7. Supporting-lens assessment (2026-10-10, §4F live)

- Contracts bumped to `v2-lean.2` / `v2-policy.2`:
  `V2Neighborhood.supportingEvidence` lists eligible supporting
  aspect ids covering the group (≥2 frozen core members in pooled
  retrieval). Old saved results still load — UI reads it with `?? []`.
- `applySupportingEvidence` (pure): membership frozen first,
  supporting only flags; provisional bridges ignored; one shared
  member insufficient; supporting-only overlap creates nothing.
- Ordering now C → X → supporting-count → stable id; supporting
  breaks ties only, never outranks discovery evidence.
- Orchestrator retrieves the frozen third lens (same categories,
  top-20, seed exclusion) inside `retrieve`; failures feed the
  `partial` data state; provisional/failed supporting gets an honest
  limitation instead of the old "deferred" note.
- UI shows "additional supporting evidence" on flagged hypotheses.
- Verify: biome clean (incl. two pre-existing lints fixed),
  184/184 suite, `next build` passes.
- Still deferred: comparison overlay, detail enrichment, evaluation
  + spec adoption (§§7, 10).

## 9. Grounded explanation (2026-10-10, §4H live)

- Contracts bumped to `v2-lean.4` (`V2NeighborhoodExplanation`:
  name + advice-framed reason + `llm-grounded`/`deterministic`
  source; one entry per ordered neighborhood on `V2Result`).
- `src/lib/agent/v2-explain.ts`: narrow frozen packet (ids,
  member names, descriptor, counts, quotable names, interpretation
  as context only); validation enforces exact id coverage,
  length caps, quoted-titles-from-evidence-only, and a mechanical
  screen for demographic/market/purchasing/reach/success claims
  (a tripwire, not semantic proof — output still labeled
  interpretation). One structured repair; double failure throws and
  the orchestrator renders `deterministicV2Explanation` (descriptor
  or overlap label + count-based advice).
- Orchestrator Stage H runs post-reach: no hypotheses means no LLM
  spend; deadline and double-failure both fall back honestly;
  provenance limitation recorded. UI shows the name, reason, and
  source marker, falling back to the descriptor for old saves.
- Verify: biome+tsc clean, 209/209 suite (10 agent + 3
  orchestrator), `next build` passes.

## 10. Overlay, enrichment, instrumentation, adoption (2026-10-10)

- Contracts `v2-lean.5`: `V2ComparisonOverlay` (query, identity,
  bounded entities, provenance — never evidence), `latencyMs` on
  usage, overlay/enrichment caps (≤2 comparisons, 1 query each into
  movies; ≤4 exact-name tag lookups, coherence reassessed once).
- Overlay (§4B): comparisons resolved pre-freeze (movie-scoped,
  honest not_found otherwise); resolved ids join frozen seeds so
  discovery excludes them; overlay never feeds grouping; no usable
  pitch references + overlay entities yields comp-led
  exploration-only. UI section "Because you mentioned these".
- Enrichment (§8 proviso): cores without a shared descriptor and
  tag-less members get exact-name `/search` tag fills merged only
  on same-id exact matches; still overlap-only on failure.
- Instrumentation (§7): latencyMs on every result + UI display,
  concurrency independence test, store round-trip replay test,
  9-pitch human pack (`fixtures/v2-pitch-pack.ts`) + procedure
  (`docs/v2-eval.md`) + private runner (`/tmp/.../v2-pack-run.mjs`).
  Synthetic failure review stays in-suite.
- Explicit type choice (§3.1): no film default; submit blocked
  until chosen; endpoint already 400s invalid types.
- Spec adoption (§10): `product-spec.md` rewritten to v2 normative
  behavior (§§1, 4–8, 10, 12–13, appendix, glossary); v1 frozen
  with no reinterpretation.
- Live notes: overlay path verified live (ambiguous "Dune" held
  back, not forced; 8/40 attempts; ~10.5s). Two preceding smokes
  hit transient brief failures (invalid/slow model output twice);
  the pipeline correctly returned unable-to-assess/unavailable
  with zero spend — provider flakiness, not a code path. Live LLM
  quality variance stays an open eval item.
- Verify: biome+tsc clean, 220/220 suite (8 orchestrator + 3
  store), `next build` passes.
- Owed to a human: the 9-pitch review pass in `docs/v2-eval.md`.

## 8. Investigation leads (2026-10-10, §4G live)

- Contracts bumped to `v2-lean.3` (`V2Lead`: id+name, seeding
  neighborhood, seed ids, category, returned-only link,
  advice-marked action, provenance). Caps: ≤2 neighborhoods, ≤3
  core seeds per signal, ≤3 leads per query, podcasts + people.
- `src/lib/qloo/v2-reach.ts`: multi-interest signal from frozen
  cores, defensive normalization (http-only links, dedupe, caps),
  failed/empty/honest statuses sharing the run budget. Never throws.
- Orchestrator Stage G runs after ordering: no hypotheses means no
  reach and no spend; deadline/budget shortfalls and failed queries
  are limitations with hypotheses left standing; affinity caveat
  recorded when leads exist. Reach failures never touch `dataState`.
- UI renders leads with type, returned link when present, and action;
  old saves without `leads` still load (`?? []`).
- Verify: biome+tsc clean, 196/196 suite (8 Q + 4 orchestrator),
  `next build` passes.
