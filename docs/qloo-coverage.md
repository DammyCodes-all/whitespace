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
