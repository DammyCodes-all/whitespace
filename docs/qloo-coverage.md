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

## Seeds

`CONTROL_SEEDS` in `src/lib/qloo/controls.ts`: 20 genre-spread controls
for film and music, 6 fallbacks for book and game. Seeds are famous,
pre-2026 titles chosen so Qloo is likely to hold them; misses are
expected signal, not errors. Live: film and music both resolved 20/20.
