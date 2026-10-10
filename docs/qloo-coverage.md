# Qloo coverage test (Day 5 Q, run live Day 6.5 Q)

Decides the demo domain by data, not preference (spec §11, §6.4, plan Day 5).
Film and music were the likeliest candidates; the live run below picks
**film** (both clear the gates; film wins on demo-story fit, §6.10 App. A).

## Status: RUN 2026-10-06 (hackathon Qloo, key in `.env.local`)

## Protocol results

Per-domain, live (`buildControls` 20 seeds × 3 titles; `fetchAllAudienceTastes`
on kept controls with `MIN_TASTES_FOR_JUDGEMENT=10`; `resolvePitchTags` on 10
probe words; one full `runPipeline` with 20 controls for quota):

| Domain | Resolve rate | Tastes ≥ 10 share | Tag match (unscoped) | Tag match (scoped) | Calls/run | Pick? |
|---|---|---|---|---|---|---|
| film | 20/20 (1.0) | 20/20 (1.0) | 10/10 | 8/10 (`slow-burn`, `cozy` no-data) | 99 | **yes** |
| music | 20/20 (1.0) | 20/20 (1.0) | 10/10 | 8/10 (`slow-burn`, `cozy` no-data) | 98 | no (viable backup) |

Both clear the 50% tastes-depth gate, so no design stop was needed. Film is
picked because the spec demo story is a film pitch (App. A), the film tag
scope (`genre:media` + `keyword:media`) got the deeper probe, and mood-word
pitches are film-shaped. Music stays a viable second domain.

## Integration fixes the run forced (all in `src/lib/qloo/`)

1. **Tastes: `filter.type=urn:tag` is required.** Without it the API silently
   ignores `signal.interests.entities` and returns empty lists (docs: Taste
   Analysis). All 20 tastes failed before, 50/50 tags after.
2. **Tags: the query param is `filter.query`, not `query`.** Bare `query`
   400s; `/v2/tags/search` 404s. See Search Tags reference.
3. **Tastes and tag resolve must scope to the same namespaces.**
   Unscoped tastes return cross-domain noise (credit-card and restaurant
   tags for movie sets), and unscoped resolve matches cross-domain names
   (`slow-burn` → `specialty_dish:place`). Per-domain scopes live in
   `src/lib/qloo/tag-scopes.ts` (film `genre:media`+`keyword:media`; music
   `genre:music`+`keyword:media`); both `tastes.ts` and `resolve-tags.ts`
   take an optional `workType` and stay unscoped without one (tests).
   Scoped probe: sci-fi set ranks `science_fiction` top-5, romcom set
   omits it; pop set ranks `pop` #1, ambient set ranks `ambient` #2.

## Discrimination check (film, genre-worded pitch)

With candidate words `science-fiction, fiction, drama, space, future,
solitude`: coverage 1.0, hyp 0.156 (matched `science-fiction`), rivals 0,
best control 0.122, verdict Weak (margin vs control 0.035, grounding ok).
The machinery separates fit from noise; margins calibrate on real pitches
in Day 10 (§6.7). Repeatability: the demo input ran twice live, same
verdict and scores (§10 #7).

## Findings for Day 10 calibration (not fixed here)

- **Exclusion subtract flattens generic matches.** Demo `nothingLike`
  "Fast franchise action" fuzzy-resolves to Fast & Furious 6, whose tastes
  include `genre:media:fiction`; subtraction then removes `fiction` from
  every audience. Spec §6.6 flags exactly this: if it behaves badly, fall
  back to an overlap warning. Test on real pitches before locking.
- **Mood words rarely intersect top-50 tastes.** `solitude`/`quiet` match
  real tags but no tested audience over-indexes them; genre words carry the
  score. The Day 6.5 propose prompt already asks for genre/mood/setting
  words — weight toward genre/theme when calibrating.
- **Demo `nothingLike` should be concrete titles.** A descriptive phrase
  ("Fast franchise action") resolves fuzzily and distorts exclusion; Day 8
  fixtures must use real titles.

## Margins v1 (set 2026-10-09, live)

`CONTROL_MARGIN` 0.1 → **0.05** in `src/lib/policy/verdict.ts`
(`SPLIT_MARGIN`/`SURPRISE_MARGIN` stay stubbed: no live Split or
surprise observed yet). Basis, all live on hackathon Qloo, film:

| Input (words) | Top | Best control | Gap |
|---|---|---|---|
| space, mid-specificity (alien/survival/dystopia/scientist, alien pinned) | hyp 0.744 | Sci-fi epic 0.644 | **0.100** |
| space, broad genre (science-fiction/fiction/dystopia/space) | rival-amb 0.488 | Horror 0.488 | 0.028 |
| horror, mid-specificity (horror/folk-horror/grief/ghost) | hyp 0.160 | Fantasy 0.180 | -0.020 |
| Day 8 pack, all 4 entries (mood-level words) | — | — | 0 (all zeros / Inconclusive) |
| user space pitch, same 4 words + auto-expansion | hyp 0.360 | Horror 0.262 | **0.098 → Strong** |

0.05 sits between observed noise (≤0.03) and observed signal (0.10).
Companion fixes shipped the same day: tag resolve prefers the
namespace variant audiences hold (pipeline resolves tags after tastes);
propose caps words at 4–6, genre/theme/setting-led (`src/lib/agent/propose.ts`).
With the bar at 0.05 the space run above returns **Strong** (top hyp,
no surprise — the guess was right).

## Day 11 fixes (shipped 2026-10-09, live-verified)

1. **Scope gate** (`src/lib/policy/scope.ts`, `src/components/scope-notice.tsx`):
   telegram-bot pitch now returns Inconclusive with reason `scope` and zero
   Qloo calls instead of a fake all-zeros Weak. Rule: tool-creation or
   utility-behavior signal without creative-work framing. A film ABOUT a
   bot stays in scope (framing wins).
2. **Concept audience** (`src/lib/qloo/concept.ts`): `signal.interests.tags`
   on `/v2/insights` verified live (sci-fi tag signal → 200, tag affinities).
   Scored as a contender beside movie-fan audiences. Live: space run stays
   **Strong** (hyp 0.360 vs Horror 0.262) with concept at 0.000 — the idea
   gets tested without circularity inflation. Horror run: concept no-data
   (short list), verdict unchanged Weak.
3. **Show the guess**: confirm panel now states hypothesis titles, rival
   readings, and words with "is that your crowd?" before the run.

## Day 10 Q status (2026-10-06)

1. **Location call: ship the guard, hide the map.** No live key in the
   working tree for a city probe, and the hackathon developer guide
   lists no city-concentration signal or filter for `/v2/insights` —
   so `src/lib/qloo/location.ts` ships the §6.8 thin-data guard
   (`MIN_PLACES_FOR_MAP = 5`), but `fetchLocation` fails closed and always returns `hidden` with a
   machine-readable reason until a verified city-scoping parameter
   exists. The map UI stays unwired; per §12 city map is cut first, so
   "hidden with reason" is the shipped state, not a TODO. When a key
   verifies a real city filter, the candidate-word probe is:
   `/v2/insights?filter.type=urn:entity:place&signal.interests.entities=...`
   plus the city filter — if results do not attribute to the city,
   keep hiding.
2. **Margins v1 stay stubbed.** No live key is available in this
   working tree, so the §6.7 calibration protocol has not run. The
   protocol is ready: run 4+ pitches (the Day 8 pack) through
   `runPipeline` in one process — the new cache and quota guard
   (§11) make the call counts meaningful — and record the observed
   hypothesis-vs-control and hypothesis-vs-rival margins as S's
   constants in `src/lib/policy/verdict.ts`. Until a key lands, the
   tracker row must not claim margins are set; `verdict.ts` keeps its
   explicit stub comments (§6.7: exact margins are decided week 1 on
   real pitches, they are not findings).
3. **`resetQuota()` per run** is wired (teammate, same day): the
   pipeline resets the quota counter at the start of each live run so
   the 150-call cap is per-run, not per-process.

## Seeds

`CONTROL_SEEDS` in `src/lib/qloo/controls.ts`: 20 genre-spread controls
for film and music, 6 fallbacks for book and game. Seeds are famous,
pre-2026 titles chosen so Qloo is likely to hold them; misses are
expected signal, not errors. Live: film and music both resolved 20/20.

## V2 capability pilot (2026-10-10, live)

Bounded §8 gate check for `docs/pipeline-redesign.md`. Ten live HTTP
calls, aggregates only — no response payloads are stored in this repo
(hackathon guide: private caching only, never commit Qloo data).
Raw output stayed in server-local temp; only counts and conclusions
below are public.

Protocol: resolve 2 film lenses (`/search`, exact-name match), then
`GET /v2/insights` with `signal.interests.entities=<lens id>` into
`urn:entity:movie` + `urn:entity:book` at `take=20`. Pairs tested:
Interstellar×Moonlight (far), Interstellar×Dune, Interstellar×Blade
Runner 2049, Her×Moonlight (near). Depth sweep take=20/50/100 on the
close pair; exclude-filter check; book-seeded podcast/person reach;
unknown-param check; repeat-query stability.

Findings (all 200s):

1. **Identity:** exact-name match beat the first hit on every resolve
   (5 candidates each). `/search` hits carried no usable type info
   (null), so name+alias matching plus the `types` request param is the
   identity signal — never first-hit acceptance.
2. **Discovery works:** movie and book categories each returned a full
   page (20/20) with entity metadata (`entity_id`, name, type/subtype,
   properties, popularity, tags on 18–20/20, external links).
   `take` honored at 20 and 50. `take=100` returned **zero** results —
   treat ~50 as the practical page cap, not an error.
3. **Overlap is sparse (the gate result):** entity overlap between two
   lenses was **0 at top-20 in every pair and category**, including
   near pairs (Interstellar×Dune, Interstellar×BR2049), and still 0 at
   take=50. Shared *tag* vocabulary is large (~900–1300 shared tags of
   ~3500–4200 per set) but generic. Per §8 this is a stop/revise
   signal: entity-overlap grouping will usually yield zero supported
   neighborhoods, so the honest first release is **reference-led
   exploration**, not fabricated discovery.
4. **Exclusion honored:** `filter.exclude.entities` removed both the
   seed and a planted result id (re-query returned 20 without them).
5. **Reach from non-film seeds works:** 3 book ids seeded podcast and
   person queries (5/5 each, all with tags). Artist as a discovery
   fallback also returns 20/20 with tags.
6. **Silent ignoring confirmed:** an unknown query param returned 200
   with identical counts — a 200 alone never proves a signal was
   honored. Repeat queries are deterministic (20/20 identical), which
   keeps client-side replay honest.

Decision: build the lean MVP (2 discovery lenses × 2 categories,
overlap-only grouping, `explorations` fallback; supporting lens,
reach, detail enrichment, comparison overlay deferred). Zero
neighborhoods is a valid result, not a failure.
