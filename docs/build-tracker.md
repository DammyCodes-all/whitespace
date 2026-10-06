# Build tracker

One row per task. Newest at the bottom. Keep it concise.

Format:

| Date (UTC) | What changed | Spec ref | Verify |
|---|---|---|---|

- **Date (UTC):** `YYYY-MM-DD`
- **What changed:** 1 line, imperative (e.g. `Add rival-audience overlap rule`).
- **Spec ref:** `§x.y` from `product-spec.md`, or `n/a` for infra-only.
- **Verify:** commands + result (e.g. `pnpm check, typecheck, build pass`).

| Date (UTC) | What changed | Spec ref | Verify |
|---|---|---|---|
| 2026-10-05 | Scaffold Next.js + Tailwind + Biome, migrate npm to pnpm | n/a | pnpm check, typecheck, build pass |
| 2026-10-05 | Add 3-dev conflict-free build plan with WAIT deps | §12 | markdown only, no build needed |
| 2026-10-05 | Rewrite build plan as clean 10-day plan + harden phase | §12 | markdown only, no build needed |
| 2026-10-05 | Rename plan days to Day N and humanize wording | §12 | markdown only, grep confirms no D1-style labels remain |
| 2026-10-05 | Add design direction doc (feel, tokens, font pairing) | n/a | markdown only, contrast ratios computed vs #F7F6F2 / #131311 |
| 2026-10-05 | Freeze Day 1 contracts: shared types, Qloo stub, run skeleton | §5, §7, §8 | biome+tsc clean on new files; next build passes in pristine copy |
| 2026-10-05 | Add Qloo title+tag resolve with not-found lists | §6.2 | pnpm check, typecheck, build pass |
| 2026-10-05 | Add rival-audience overlap rule with rival selection | §6.3 | pnpm check, typecheck, build pass; tsx smoke 11/11 (ratio, boundary 1/3, select, caps) |
| 2026-10-05 | Add pitch form with similar-to confirm on fixtures | §6.1, §6.2 | pnpm check, typecheck, build pass |
| 2026-10-05 | Fix review findings: QlooError-only catch, tags path override, grounded confirm | §6.2, §6.5, §7 | pnpm check, typecheck, build pass; tsx fix checks pass |
| 2026-10-06 | Note that Day 3 to Day 5 U lifts the inline mock views into the planned components | §12 | markdown only, grep confirms note present; no code changed |
| 2026-10-06 | Add fit-score 0 to 1 with rank norm, pinned x2, zero vs no-data | §6.6 | biome+tsc clean; node strip-types smoke 7/7; next build pass |
| 2026-10-06 | Add audience tastes fetch on /v2/insights with per-item never-throw | §6.6 | biome+tsc clean; next build pass (mock path yields no-data) |
| 2026-10-06 | Add run-steps fake-stream player on fixtures | §5.4 | biome+tsc clean; next build pass |
| 2026-10-06 | Add control test plus verdict with tunable margins stub | §6.7 | biome+tsc clean; tsx smoke 8/8 branches; next build pass |
| 2026-10-06 | Add rival retry and replace grounded on resolve plus overlap | §6.3 | biome+tsc clean; tsx mock-path smoke; next build pass |
| 2026-10-06 | Add verdict headline plus ranked list, lift /run onto them | §6.7 | biome+tsc clean; next build pass |
| 2026-10-06 | Add exclusion subtract plus grounding check plus coverage report | §6.6, §8 | biome+tsc clean; tsx smoke 8/8; next build pass |
| 2026-10-06 | Add 20 control seeds plus coverage test protocol doc | §6.4 | biome+tsc clean; tsx smoke 60 calls traced; next build pass |
| 2026-10-06 | Add evidence calls component plus saved-run store, lift /run | §6.12 | biome+tsc clean; tsx round-trip smoke; next build pass |
| 2026-10-06 | Split resolve, controls, pitch-form into modules under 200 lines | n/a | biome+tsc clean; tsx barrel+seeds smoke; next build pass |
| 2026-10-05 | Fix pnpm Node 22 shim via nvm install 22 + global pnpm 10.30.1 | n/a | pnpm -v 10.30.1; pnpm install --frozen-lockfile passes |
| 2026-10-06 | Merge origin Day 2/4/5 work; port Day 3 scoring tests onto shared fit API | §6.6 | biome scoped clean; node:test pass; typecheck+build pass |
| 2026-10-06 | Fix review findings: honest verdict margins, single stream player, unified coverage | §6.7, §10 #4 | biome scoped clean; node:test 18 pass; typecheck+build pass |
| 2026-10-06 | Add Day 7 Q related-items fetch with fixtures and label map | §6.8 | biome scoped clean; node:test 29 pass; typecheck+build pass |
| 2026-10-06 | Add Qloo public seam barrel for pipeline wiring | §7 | biome+tsc clean on new file; tsx seam smoke 17/17; next build pass |
| 2026-10-06 | Wire runPipeline from Qloo seam to score to verdict on fixtures | §5.4, §6, §7, §8 | biome+tsc clean; tsx --test 4/4 (shape, Inconclusive, repeatability, empty); next build pass |
| 2026-10-06 | Wire run page to seam with step evidence plus save-only island | §5.4, §6.12, §10 #6 | biome+tsc clean; next build pass; tsx step check 7/7 |
| 2026-10-06 | Add missing LLM seam, form-to-run wiring, coverage run to plan | §7, §6.1 | markdown only, no build needed |
| 2026-10-06 | Add Day 7 U reach plan UI with gaps on pipeline result | §6.8 | biome scoped clean; node:test 48 pass; typecheck+build pass |
| 2026-10-06 | Add Day 7 S gap finder with tests | §6.8 | biome scoped clean; node:test pass; typecheck+build pass |
| 2026-10-06 | Fix review findings: parallel reach fetch, unique shelf keys | §6.8, §10 #6 | biome scoped clean; typecheck+build pass |
| 2026-10-06 | Add pinned-tags UI and chatbot no-tools answer rows to plan | §6.6, §6.11 | markdown only, no build needed |
| 2026-10-06 | Add LLM proposal seam Groq-first OpenRouter-fallback plus propose API | §7, §6.2, §6.3, §6.5 | biome+tsc clean; node24 strip-types 48 pass; next build pass; keyless 503 smoke |
| 2026-10-06 | Wire pitch form through propose plus confirm to /run ?input= | §6.1 | biome+tsc clean; node24 strip-types 48 pass; next build pass |
| 2026-10-06 | Add pinned must-have words UI with pinnedWords through scoring | §6.6 | biome+tsc clean; pinned mock-path smoke; next build pass |
| 2026-10-06 | Fix review findings: single-decode run parser, client defaults split, proposed badge, pinned normalize | §6.1, §6.2, §6.6 | biome+tsc clean; node24 strip-types 62 pass; next build pass; pct/pinned smoke |
