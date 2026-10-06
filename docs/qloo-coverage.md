# Qloo coverage test (Day 5 Q)

Decides the demo domain by data, not preference (spec §11, §6.4, plan Day 5).
Film and music are the likeliest candidates, but that is a guess until
this runs against live Qloo.

## Status: NOT YET RUN (no API key in this env)

## Protocol

For each domain (`film`, `music`), with `QLOO_API_KEY` set:

1. Resolve: run `buildControls(domain)` from `src/lib/qloo/controls.ts`
   (20 seeds × 3 titles). Record resolve rate = controls kept ÷ 20.
2. Tastes: run `fetchAllAudienceTastes` on the kept controls. Record the
   share of controls returning 10+ tag ids (`MIN_TASTES_FOR_JUDGEMENT`).
3. Tags: run `resolvePitchTags` on 10 probe words
   (slow-burn, solitude, quiet, space, isolation, neon, grief, heist,
   cozy, epic). Record match rate.
4. Quota: count calls per full run (resolve + tastes for
   hypothesis + 3 rivals + 20 controls + exclusion).

## Decision table (fill in live)

| Domain | Resolve rate | Tastes ≥ 10 share | Tag match | Calls/run | Pick? |
|---|---|---|---|---|---|
| film | TBD | TBD | TBD | TBD | TBD |
| music | TBD | TBD | TBD | TBD | TBD |

Pick the domain with the best tastes depth first, resolve rate second.
If neither clears 50% tastes depth, stop and review the design before
building more (spec §10 #3 spirit: the pipeline needs judgeable lists).

## Seeds

`CONTROL_SEEDS` in `src/lib/qloo/controls.ts`: 20 genre-spread controls
for film and music, 6 fallbacks for book and game. Seeds are famous,
pre-2026 titles chosen so Qloo is likely to hold them; misses are
expected signal, not errors.
