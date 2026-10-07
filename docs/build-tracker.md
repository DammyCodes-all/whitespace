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
| 2026-10-06 | Add Day 8 U change UI with constraint flow on run page | §6.9, §10 #5 | biome scoped clean; node:test 72 pass; typecheck clean |
| 2026-10-06 | Fix review findings: parallel reach fetch, unique shelf keys, preview mocks | §6.8, §10 #6 | biome scoped clean; typecheck+build pass |
| 2026-10-06 | Add Day 7 S gap finder with tests | §6.8 | biome scoped clean; node:test pass; typecheck+build pass |
| 2026-10-06 | Add Day 8 Q pitch pack plus cache and quota guard | §6.9, §11 | biome scoped clean; node:test 55 pass; typecheck clean |
| 2026-10-06 | Add Day 8 S change bar plus proposal orchestration | §6.9, §10 #5 | biome scoped clean; node:test 70 pass; typecheck+build pass |
| 2026-10-06 | Fix review findings: parallel reach fetch, unique shelf keys | §6.8, §10 #6 | biome scoped clean; typecheck+build pass |
| 2026-10-06 | Add pinned-tags UI and chatbot no-tools answer rows to plan | §6.6, §6.11 | markdown only, no build needed |
| 2026-10-06 | Add LLM proposal seam Groq-first OpenRouter-fallback plus propose API | §7, §6.2, §6.3, §6.5 | biome+tsc clean; node24 strip-types 48 pass; next build pass; keyless 503 smoke |
| 2026-10-06 | Wire pitch form through propose plus confirm to /run ?input= | §6.1 | biome+tsc clean; node24 strip-types 48 pass; next build pass |
| 2026-10-06 | Add pinned must-have words UI with pinnedWords through scoring | §6.6 | biome+tsc clean; pinned mock-path smoke; next build pass |
| 2026-10-06 | Fix review findings: single-decode run parser, client defaults split, proposed badge, pinned normalize | §6.1, §6.2, §6.6 | biome+tsc clean; node24 strip-types 62 pass; next build pass; pct/pinned smoke |
| 2026-10-06 | Run Qloo coverage live, fix taste/tag params plus namespace scopes, lock film | §11, §6.4, §6.6 | live: resolve 20/20 both, tastes 20/20, tags 8/10 scoped; 62 pass; discrimination probe hyp 0.156 vs control 0.122 |
| 2026-10-06 | Add inconclusiveReason to verdict plus boundary tests (types unfreeze: additive optional field only) | §6.7, §6.10 | biome+tsc clean; node24 strip-types verdict 7 pass |
| 2026-10-06 | Add chatbot title-mark helper on resolve plus seam export | §6.11 | biome+tsc clean; node24 strip-types mark 3 pass |
| 2026-10-06 | Add plain chatbot answer seam plus /api/chatbot plus /run preview with Qloo marks | §6.11 | biome+tsc clean; 16 pass (chatbot+propose refactor); build pass; /run 200 with preview, keyless 503 path tested |
| 2026-10-06 | Add audience case builder plus /case page plus shared reach assembly plus print styles | §6.10, §6.12 | biome+tsc clean; 79 pass full suite; build pass; /case 200 with evidence, reach, limits, footer |
| 2026-10-06 | Refresh LLM default models (both old slugs dead) plus live shape verify | §7 | live lists: groq has no llama-3.3, or has no llama-3.3-free; picked gpt-oss-120b + nemotron-ultra-550b-free, both JSON-verified; propose 5/9/3 + chatbot 437ch/2 live; biome+tsc clean; 16 pass |
| 2026-10-06 | Fix post-merge import sort in Day 8 propose-stub | n/a | biome --write one file; check+typecheck clean; 98 pass; build pass; /run+/case smoke 200 |
| 2026-10-06 | Reset Qloo quota per run plus settle mock steps to done | §11, §5.4 | quota counter never reset so 2nd live run tripped 150 cap (QlooQuotaError) into mock fallback; live double-run 99+99 calls both resolve; mock score/verdict were active/pending; 103 pass; check+typecheck+build clean |
| 2026-10-06 | Day 10 Q: location thin-data guard plus coverage doc status | §6.8, §12, §10 #4 | location.ts fails closed (no city-concentration signal in hackathon guide), thin-data guard tested, map UI stays unwired; biome+tsc clean; 19 pass qloo suite; build pass; margins v1 stubbed pending key |
| 2026-10-06 | Day 10 U: side-by-side chatbot compare, openable evidence calls, saved-run replay | §6.11, §6.12, §9, §10 #6/#8 | focused U suite 22 pass; touched-file biome+tsc clean; build pass; full check still blocked by pre-existing .vscode/extensions.json formatting |
| 2026-10-06 | Address U review findings: retain replay runs, show response summaries, link comparison evidence | §6.12 | focused Q/U suite 31 pass; biome+tsc clean on touched files; build pass |
| 2026-10-06 | Improve LLM word prompt plus widen tag scopes to mood/theme/setting | §6.5, §6.6, §6.7 | propose prompt now prefers taste-level genre/theme/mood/setting and avoids logistics; tag scopes extended; focused tests 12 pass; full 103 pass; check+typecheck+build clean |
| 2026-10-06 | Revamp first screen into idea-only pitch flow | §6.1 | giant idea input above the fold, optional similar-to/nothing-like on step 2, example goes straight to /run, 103 pass; check+typecheck+build clean |
| 2026-10-06 | Refresh homepage CTA hierarchy, labels, eyebrow, and optional skip path | §5, §6.1 | pnpm check, typecheck, build pass; browser smoke confirms focus ring and skip link clean |
| 2026-10-06 | Enforce measured-only accent, semantic no-data labels, mobile targets, and cached sample arc | §6.7, §6.12 | pnpm check, typecheck, build pass; cached /run smoke shows Strong surprise and not measured state |
| 2026-10-06 | Widen shared page shells for desktop while preserving readable prose measures | n/a | pnpm check, typecheck, build pass |
| 2026-10-06 | Center the full-width home surface around a 720px input-first hero | §5, §6.1 | pnpm check, typecheck, build pass; home smoke confirms page-width surface and hidden New fit link |
| 2026-10-06 | Widen the centered home hero, remove the eyebrow, and sharpen the headline copy | §1, §5 | pnpm check, typecheck, build pass |
| 2026-10-06 | Add more top breathing room to the centered home hero | n/a | pnpm check, typecheck, build pass |
| 2026-10-06 | Refine home input hierarchy, CTA empty state, copy, and spacing | §5, §6.1 | pnpm check, typecheck, build pass; eyebrow intentionally omitted |
| 2026-10-06 | Remove the bottom border from the site navigation header | n/a | pnpm check, typecheck pass |
| 2026-10-06 | Remove the visible homepage textarea label while preserving accessible naming | n/a | pnpm check, typecheck pass |
| 2026-10-06 | Remove the shared footer disclaimer and separator from the page shell | n/a | pnpm check, typecheck, build pass |
| 2026-10-06 | Redesign the homepage input surface and action row | §5, §6.1 | pnpm check, typecheck, build pass; browser smoke confirms 720px input and ink CTA |
| 2026-10-07 | Redesign chatbot comparison with asymmetric panels, grounding tally, and measured states | §6.11, §6.12, §6.7 | biome+tsc clean on touched file; build pass; chatbot+mark 10 pass |
| 2026-10-07 | Redesign reach plan with 2-col shelves, Rank labels, and tally line | §6.8, §6.12 | biome+tsc clean on touched file; build pass |
| 2026-10-07 | Tone down reach plan type changes, keep layout and tally | §6.8 | biome+tsc clean; build pass |
