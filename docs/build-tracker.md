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
| 2026-10-08 | Claim-first evidence calls with All-calls collapse | §6.10, §6.12 | biome+tsc clean; next build pass; case suite 3 pass |
| 2026-10-08 | Lighten evidence rows, quiet full-trace toggle | §6.12 | biome+tsc clean; next build pass |
| 2026-10-12 | Add static end-result mock page at /demo/result | §6.7, §6.8, §6.9, §6.11, §6.12 | pnpm build pass |
| 2026-10-12 | Remove evidence calls from end-result mock | §6.7, §6.8, §6.11 | pnpm build pass |
| 2026-10-08 | Animate evidence accordions with CSS grid rows | §6.12 | biome+tsc clean; next build pass |
| 2026-10-08 | Fix accordion snap with starting-style start frame | §6.12 | biome+tsc clean; next build pass; starting-style verified in built CSS |
| 2026-10-08 | Redesign saved-run replay with human labels | §6.12 | biome+tsc clean; next build pass |
| 2026-10-08 | Dedupe replay verdict, word-boundary cuts, honest 0 | §6.6, §10 #4 | biome+tsc clean; next build pass |
| 2026-10-08 | Distill replay to top-3 scores, hide ties | §6.12 | biome+tsc clean; next build pass |
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
| 2026-10-08 | Rewrite compare view copy with takeaway line and titles-check framing | §6.11, §6.7, §6.12 | biome+tsc clean on touched file; build pass |
| 2026-10-08 | Add margins, runner-up, basis titles, and ceiling to compare left panel | §6.7, §6.11, §6.12 | biome+tsc clean on touched file; build pass |
| 2026-10-09 | Set home headline to Instrument Serif single-line nowrap | §1, §5 | biome clean on page, tsc clean |
| 2026-10-09 | Center home headline and tighten headline-subtitle gap | §1, §5 | biome clean on page, tsc clean |
| 2026-10-09 | Remove hardcoded pre-run title check, resolve all titles live at run | §6.2 | biome+tsc clean on touched files; build pass |
| 2026-10-09 | Prefer taste-held tag namespace variant, resolve tags after tastes | §6.5, §6.6 | biome+tsc clean; 107 pass node --test; live: dystopia picks keyword variant at rank 7 |
| 2026-10-09 | Cap candidate words 4 to 6, genre-led prompt plus sharper demo words | §6.5 | biome+tsc clean; propose cap test updated; 107 pass |
| 2026-10-09 | Set CONTROL_MARGIN 0.05 from live gaps plus float epsilon | §6.7 | 107 pass; live space run returns Strong (hyp 0.744 vs control 0.644) |
| 2026-10-09 | Add automatic tag-expansion retry from hypothesis tastes at half weight | §6.5, §6.6, §8 | biome+tsc clean; 116 pass node --test; live user pitch flips Weak to Strong (hyp 0.360 vs Horror 0.262) |
| 2026-10-09 | Add scope gate refusing tool/app pitches as Inconclusive/scope with explained card (types unfreeze: additive reason only) | §3, §6.7, §10 #4 | biome+tsc clean; 124 pass node --test; live bot pitch returns scope with zero Qloo calls; build pass |
| 2026-10-09 | Add concept audience from pitch-tag signals scored beside movie-fan audiences | §6.6, §7, §8 | biome+tsc clean; live tag-signal verified 200; space run stays Strong with concept 0.000 (no circularity); build pass |
| 2026-10-09 | Show the guess on confirm: hypothesis titles, rival readings, words, is-that-your-crowd | §5, §6.2, §6.3 | biome+tsc clean; build pass |
| 2026-10-09 | Use live taste names for gaps plus honest empty states, drop untracked line | §6.8 | biome+tsc clean on touched files; node --test 23 pass (gaps/change/reach-targets) |
| 2026-10-09 | Remove hijacked api.js dropper, restore scripts, surface LLM error causes | §7 | tsc clean; agent tests 16 pass; live /api/propose 200 (biome format pre-existing CRLF fail) |
| 2026-10-10 | Remove dead dark-mode variant from tokens | n/a | grep confirms no .dark/dark: refs remain; tsc clean |
| 2026-10-10 | Restore dark-mode variant block, owner-authored Oct 5 | n/a | git diff empty vs HEAD on globals.css; tsc clean |
| 2026-10-10 | Redesign saved-run replay as editorial list plus detail | §6.12 | tsc clean; 113 pass node --test; next build pass |
| 2026-10-10 | Collapse saved-run list to selected plus all-runs toggle | §6.12 | tsc clean; 113 pass node --test; next build pass |
| 2026-10-10 | Propose discovery-led v2 pipeline, glossary, spec deltas, capability gates, and phased migration | §1–§4, §5–§8, §10, §12 | Docs only; static code and public Qloo docs reviewed; no live API tests; shell validation blocked by TTY setup |
| 2026-10-10 | Run v2 capability pilot live (10 calls, aggregates only, no payloads stored) | pipeline-redesign §8 | Overlap 0 at top-20/50 all pairs+cats; take=100 empty; exclude honored; book-seeded reach 5/5; repeat deterministic |
| 2026-10-10 | Add lean v2 contracts, overlap-only discovery, states, synthetic fixtures, 18 tests | pipeline-redesign §§4–5 | biome+tsc clean on new files; node24 18/18 v2, 142/142 full; next build pass |
| 2026-10-10 | Add v2 Qloo identity (exact-match, ambiguity) plus discovery evidence with budget ledger | pipeline-redesign §§4B, 4D | biome+tsc clean; node24 12/12 v2-identity, live shapes probed privately (keys only) |
| 2026-10-10 | Add v2 brief proposal with excerpt fidelity plus one structured repair | pipeline-redesign §4A | biome+tsc clean; node24 7/7 v2-brief with stubbed transport |
| 2026-10-10 | Add v2 analyzePitch orchestrator with frozen manifest, states, budget, deadline | pipeline-redesign §§4C, 5, 6 | biome+tsc clean; node24 15/15 run; 176/176 full; next build pass |
| 2026-10-10 | Probe artist-category overlap for v2 grouping (4 calls, aggregates only) | pipeline-redesign §4D, §8 | Near pair shares 5/20 coherent artists, far pair 0; movie+artist pair recommended |
| 2026-10-10 | Switch v2 discovery pair to movie+artist per pilot verdict | pipeline-redesign §4D | pilot-gated fallback; node24 176/176 full; next build pass |
| 2026-10-10 | Add POST /api/analyze plus /analyze page with correction flow and client replay | pipeline-redesign §§3, 5 | biome+tsc clean; live smoke 200 in ~15s, exploration-only/complete, 9 attempts |
| 2026-10-10 | Implement §4F supporting-lens assessment: frozen third lens retrieved, flags frozen cores, reorders ties, never creates members | pipeline-redesign §4F | biome clean; node24 184/184 (8 new); next build pass |
| 2026-10-10 | Implement §4G investigation leads: group-seeded podcast/person reach as downstream suggestions | pipeline-redesign §4G | biome+tsc clean; node24 196/196 (12 new); next build pass |
| 2026-10-10 | Implement §4H grounded explanation: validated LLM words with claim screen, one repair, deterministic fallback | pipeline-redesign §4H | biome+tsc clean; node24 209/209 (13 new); next build pass |
| 2026-10-10 | Implement comparison overlay (§4B), detail enrichment (§8 proviso), latency/concurrency/replay instrumentation (§7), explicit type choice (§3.1); adopt spec deltas (§10) | pipeline-redesign §§3.1, 4B, 7, 8, 10; product-spec §§1, 4–8, 10, 12–13 + glossary | biome+tsc clean; node24 220/220 (11 new); next build pass; live smoke 200 with overlay path live |
| 2026-10-10 | Review v2 integration and spec fidelity; document reproducible grounding, budget, state, and replay defects | §5–§8, §10 | Node24 --test: 96/96 v2, 220/220 full; pnpm typecheck --incremental false passes; network-free synthetic repros confirmed; no implementation edits |
| 2026-10-10 | Fix v2 entry, replay, exact confirmations, grounding, grouping, provider accounting, failure states, and cancellation | §5, §6.3–§6.9, §6.12, §8, §10 | Final tsc --noEmit --incremental false and scoped Biome exit 0; no additional full-suite/build/live API runs per user; manual testing next |
| 2026-10-10 | Merge remote main keeping abort/cancel plus error-cause surfacing | §7 | pnpm typecheck pass; biome clean on touched file; ts tests not runnable (no tsx, node lacks TS support) |
| 2026-10-10 | Show candidate hypotheses on first run (projected grouping, one-click confirm); fix deadline test clock | pipeline-redesign §§4B, 4E; product-spec §6.5 | biome+tsc clean; node24 377/377 (3 new); next build pass; live smoke 200 with candidate path live |
| 2026-10-10 | Adapt UI to Oct 10 design direction (tokens, Bricolage/Figtree/DM Mono, chunky cards+buttons, dot cites, 28px bars, coral surprise, ink refusal, no dark mode) | design-direction §§1–5 | biome+tsc clean; node24 378/378; next build pass |
| 2026-10-10 | Remove v2 pipeline and revert to v1 (delete 32 v2 files/routes; restore v1 home, header, spec from pre-v2 base; de-v2 shared qloo client and agent tests; keep security/gaps/design work) | product-spec v1; design-direction §1 | tsc exit 0; biome clean; node24 134/134 v1; next build pass, routes / /run /case /api/chatbot /api/propose |
| 2026-10-10 | Package A: capture real request+response per Qloo call (bounded, key-stripped, truncated marked), serve interests from already-fetched taste tags (0 new calls, live-verified 50/50 named), cache control tag sets per pitch type with 30min TTL, report Qloo calls before/after | flow brief §4, §7; §6.8, §6.12 | node24 150/150 (+16 new); tsc+biome clean; live run1 100 calls / run2 20 (controls cached) |
| 2026-10-10 | Package B: one config file, flow orchestrator with tag gate + scope gate + cached controls (exclusion/expansion/concept/change/chatbot/location unwired), LLM tag extraction, adapter contract types | flow brief §§1–7; §6.5–§6.7 | node24 159/159 (+9 new); tsc+biome clean |
| 2026-10-11 | Package C: /flow page (input, tag chips with live match status + stop gate, run stream, results on adapter only, targeting-brief copy, evidence drawer), POST /api/tags + /api/flow, landing CTA; fixtures only for hard states | flow brief §§1–2, §8; design-direction §§1–3, §6 | node24 161/161; tsc+biome clean; next build pass; live smoke 200s end to end |
| 2026-10-11 | Fix unjudged-control ceiling: only judgeable controls set the ceiling; an all-unjudgeable control batch is Inconclusive/no-control, never a fake Strong (was: placeholder 0 acted as ceiling 0) | §6.7, §10 #4 | 3 new verdict tests; node24 169/169; live 5-pitch table |
| 2026-10-11 | Cross-domain rivals by Qloo data: one /v2/insights call per entity type (comma-joined filter.type 400s live), round-robin spread, names are Qloo facts; LLM proposes no audiences | flow brief §3; v1 spec App. A | 5 new discovery tests; live: book+artist rivals beside movie rivals |
| 2026-10-11 | Hunt live Strong on flow path: 6 sharp film pitches, cyberpunk Strong (named 0.26 vs ceiling 0.15, gap 0.11) with first live real-data reach plan; other 5 Weak; Split/surprise still unobserved | flow brief §3; §6.7, §6.8 | node24 live: tag probe 36/36 matched; 6 flows, run1 90 calls / runs 2–6 ~87 (controls cached) |
| 2026-10-11 | Suggest similar-to titles from the tag LLM call (tap-to-add, resolved live at run time, misses reported never scored); stop vacuous runs before controls with a named cause; extractor prefers concrete words over generic genre labels | §6.2, §6.5, §6.7, §7, §8 | 4 new tests, 19/19 flow+agent pass; tsc+biome clean on touched files; live extract returns hacker/android/robot + BR/Matrix/GitS suggestions |
| 2026-10-11 | Wire landing text box straight into the new flow: home hero entry routes to /flow?pitch=… with auto-started tag extraction, no intermediate button | flow brief §1 | tsc+biome clean; 169/169; build pass; live page smoke |
| 2026-10-11 | Drop every type box: the tag-extraction call reads film/music/book/game from the pitch in the same response; no selector on landing or flow, detected type shown as text | flow brief §1 | 5 extraction tests; live film/music/book all detected, tags matched in-type; home has no type control |
| 2026-10-12 | Run 5-pitch live tables for music/book/game: music ships (2 strong incl. 0.633 vs 0.333, 3 weak, reach on strongs), book/game hold (tops ~0.000, 0 strongs ex one 0.067-vs-zero, 6-seed controls per control-seeds.ts) | flow brief §§1–7 | 13 live flows + 2 probes; music 5/5 detected; book 4 weak + 1 inconclusive; game 4 weak + 1 thin strong |
| 2026-10-12 | Research book/game taste gap in docs + live: book entities return 0 taste tags even unscoped (Dune + Pride and Prejudice, data gap, unfixable in-app); game tastes live in qloo namespaces (keyword:qloo, theme:qloo…), our media-only scope collapses 50 tags to 19 — fix is game scope retune + re-probe | docs.qloo.com taste-analysis + entity-type guide; flow brief §6.6 | 11 live probe calls, aggregates only; book 0/0 unscoped, game 50 unscoped vs 19 scoped |
| 2026-10-12 | Retune game to qloo namespaces + re-probe 3 pitches: tags now resolve richly (cozy, cyberpunk, hacker…) but tops stay 0.000–0.056 with 0–1 tag hits across ~10 audiences — game taste vectors too diffuse to discriminate; games hold, film+music ship | flow brief §6.6 | tsc 0, biome clean, 172/172; 3 live flows: 1 thin strong, 2 weak |
| 2026-10-12 | Re-run 6-pitch hunt through full LLM path (extract→resolve→flow, suggested titles as similar-to): 3 Strong / 3 Weak, coverage 1.0 on 5/6; cyberpunk holds, mystery-noir + western flip Weak→Strong on LLM word choice | flow brief §3; §6.5, §6.7 | node24 live 6 flows (~87–95 calls each, controls cached); no stops; heist 0 rivals stays honest Weak |
| 2026-10-12 | Probe repeatability (cyberpunk x3, mystery-noir x5, full LLM path): LLM wording wobbles verdicts (cyberpunk flips Strong→Weak dropping dystopia/robot); first live Split + rival-led Strong observed; identical words repeat identically | §6.7, §10 #7 | node24 live 8 flows (~90–98 calls); words vary 5–8/run, titles stable; runs 4/5 identical → Qloo side deterministic, wobble is LLM-side |
| 2026-10-12 | Instrument cyberpunk x3 for 0-ceiling mystery: no recurrence (ceilings 0.11–0.15, all 200s, 0 nulls); verdict is flaky-window data, fix is an all-zero-opposition guard, not scoring | §6.7, §10 #4 | node24 live 3 flows with per-stage statuses + per-control scores; 14–16/20 controls at judged 0 normally |
| 2026-10-12 | Guard won-against-nothing (judgeable ceiling 0 → Inconclusive/no-signal), seed discovery with all matched tags (was first 5), close-call flag within 0.06 of the line in results + brief | §6.7, §6.3, §10 #4 | 43/43 touched suites pass; tsc+biome clean; live: 8-tag discovery check throttled (429s, key hot after ~2k probe calls) — re-check scheduled |
| 2026-10-12 | Merge origin/main keeping both build-tracker histories, dedupe hijacked row | n/a | tsc clean; node --test 172 pass; tracker ignored by biome |
| 2026-10-12 | Resolve build-tracker merge conflict and preserve both histories | n/a | pnpm typecheck and pnpm build pass; pnpm check reports pre-existing issues outside tracker |
| 2026-10-12 | Soften primary button to ink-2 with ink hover plus pointer cursor on both buttons | design-direction §§1–5 | tsc clean; biome pre-existing CRLF fail on globals.css |
| 2026-10-12 | Replace running-pitch buttons with Dots loading status in ink tokens plus keyframes | design-direction §1 | tsc clean; biome lint clean; 172 pass node --test |
| 2026-10-12 | Match pitch input border and radius to buttons (2px outline, 16px) | design-direction §§1–5 | tsc clean; biome lint clean on 3 files |
| 2026-10-12 | Add button-style offset shadow to pitch inputs | design-direction §§1–5 | tsc clean; biome lint clean; next build pass, shadow in built CSS |
| 2026-10-12 | Give Running-pitch loader breathing room: block outputs plus vertical padding | n/a (spec silent on loader spacing) | tsc clean; biome CRLF-only pre-existing fail |
| 2026-10-12 | Check live APIs: Qloo still rate-limited on monthly quota (0 of 10000 remaining, resets in ~23 days), Groq healthy | n/a | live probes: Qloo 429 x3 with x-month-ratelimit-remaining 0; Groq 200 on gpt-oss-120b; /api/tags 200 with LLM fine but 0/6 tags matched (Qloo calls degrade to not_found) |
| 2026-10-12 | Add /demo design-system showcase: every token and component in 15 sections, server-rendered with fixtures | n/a (spec silent; design-direction §6 rules) | tsc clean; biome lint clean; 185 pass node --test; next build pass; /demo 200 static, all 22 anchors resolve |
| 2026-10-12 | Make FlowResultView honestly a Server Component: extract the targeting-brief builder to lib/flow/brief.ts (7 tests) and move its clipboard button into a client island | design-direction §6, §6.12 | tsc clean; biome lint clean; 185 pass node --test; next build pass; /demo /flow /case all render |
| 2026-10-12 | Show orange surprise banner on demo result page (black headline, white verdict word) | design-direction §3 (label white per user override) | tsc clean |
| 2026-10-12 | Remove [e] evidence links from flow results view per user request (conflicts with §6.12 checkability) | §6.12 (removed despite spec) | tsc clean |
| 2026-10-12 | Rewrite banner baseline as a plain sentence and drop Qloo-calls count | §6.7 | tsc clean |
| 2026-10-12 | Show bar scores as percentages with a Who fits best heading, drop role tags | n/a (spec silent on number format) | tsc clean |
| 2026-10-12 | Scale result bars to 100 and rename the line pill to the bar (design-direction §2 updated) | n/a (spec silent on bar scale) | tsc clean |
| 2026-10-12 | Add per-row beats and misses lines under each bar | §6.7 | tsc clean |
| 2026-10-12 | Color bars by rank, round the track edges (design-direction §2 updated) | n/a (spec silent; user override) | tsc clean |
| 2026-10-12 | Rename reach plan to where to find them in plain words | §6.7 | tsc clean |
| 2026-10-12 | Render reach slots as cards with Places spanning full width | design-direction §§1, 3 | tsc clean |
| 2026-10-12 | Give each reach slot a fixed fill (interests mint, people yellow, podcasts blue, brands mint, places yellow) | design-direction §3 | tsc clean |
| 2026-10-13 | Remove targeting-brief section from flow results view (builder module and tests stay) | n/a (spec silent on placement) | tsc clean; brief tests pass |
| 2026-10-13 | Put compare verdict word on a verdict-fill band, neutral for Weak and Inconclusive | §6.11 | tsc clean |
| 2026-10-13 | Rewrite compare left panel in plain words and drop top-audience cites | §6.11, §6.7 (§6.12 cites removed, same override) | tsc clean |
| 2026-10-13 | Frame chatbot panel as unmeasured with a dashed card | design-direction §1 | tsc clean |
| 2026-10-13 | Rewrite chatbot title checks in plain words and drop chatbot cites | §6.11 (§6.12 cites removed, same override) | tsc clean |
| 2026-10-13 | Restore reach header styling missed in the commit split (larger group names, quieter explainer) | design-direction §4 | tsc clean |
| 2026-10-13 | Rewrite result copy in plain words: say what the score measures and where 100% sits, define the bar once next to the chart, give every margin a "points" unit, and say the audience came from the titles you named | §6.6, §6.7 | tsc clean; node --test 185/185; /demo/result server HTML carries every new sentence (score line verified with a temporarily-flipped surprise fixture, fixture restored); biome residual errors are the pre-existing CRLF plus unformatted blocks from earlier commits |
| 2026-10-13 | Cut the compare header to the heading plus two sentences (dropped the explainer that repeated the takeaway) | §6.11 | tsc clean; /demo/result HTML shows heading + takeaway only, "Same pitch" gone from the page |
| 2026-10-13 | Rename the verdict word Split to Mixed end to end (Verdict type, policy branch, flow mapping, UI labels, demo fixtures, 4 test files) and align product-spec §6.7/§6.8 with design-direction §3, so spec, code and screen carry one word | §6.7 | pnpm typecheck clean; node --test 185/185; /demo renders "Mixed fit", zero "Split" verdict strings left in src (only the `--split` paint token, documented as such) |
| 2026-10-13 | Wire the plain-words result copy end to end: audience, its score, the unrelated level and the runner-up each on their own line, "an unrelated group" replaces the bar metaphor, per-row difference lines dropped so no reader subtracts, chatbot card says nothing was checked | §6.6, §6.7, §6.11 | pnpm typecheck clean; node --test 185/185; /demo/result renders the new copy on both cards (72% / 44% / 61% stated outright, Inconclusive withholds its numbers) |
| 2026-10-14 | Build compare card copy from data via pure buildCopy (badge/body/source, single pct helper, 11 tests) and wire it into CompareView; spec §6.7 and VERDICT_WORDS already said Mixed, evidence drawer groups control calls under Control audiences | §6.7, §6.11 | tsc clean; biome lint clean; 196/196 tests; /demo/result serves every generated sentence |
| 2026-10-14 | Redesign accepted change as a mint card with pure copy builders (Was 61% now 72%, Addresses kept, withheld fallback plain, recheck cite dropped) per council verdict | §6.9 (§6.12 cite removed, same override) | tsc clean; biome lint clean; 200/200 tests; /demo/result serves every new sentence |
| 2026-10-14 | Pair first-group gaps with the change card in an unequal bento grid (gaps 7 left, change 5 right) via optional ReachPlan sidecar | §6.8, §6.9 | tsc clean; biome lint clean; /demo/result grid order verified in HTML |
| 2026-10-14 | Stretch bento cards to equal row height (h-full on gaps and change cards, grid default stretch) | §6.8, §6.9 | tsc clean; biome lint clean; 200/200 tests; /demo/result serves stretched cards |
| 2026-10-14 | Give the gaps card the yellow fill so the bento pair differs (change keeps mint as the landed color) | §6.8 | tsc clean; biome lint clean; /demo/result serves yellow gaps cards |
| 2026-10-14 | Fix fills never showing: move .card to @layer components so bg-* utilities win over the default surface (change mint, gaps yellow, verdict and slot fills all affected; design-direction §5 updated) | design-direction §§3, 5 | tsc clean; next build pass; compiled CSS shows .card in components layer ahead of bg-* utilities |
| 2026-10-14 | Drop evidence links from gap-list rows (shelf cites stay; conflicts with §6.12 checkability) | §6.12 (removed despite spec) | tsc clean; biome lint clean; 200/200 tests; gap rows render bare ranks in HTML |
| 2026-10-14 | Make gap-list row dividers ink black to match the card outline | design-direction §1 | tsc clean; biome lint clean; served HTML carries divide-outline |
| 2026-10-14 | Set gaps footer to white per user request (note: ~1.4:1 on yellow, below the 4.5:1 floor, rule left intact) | design-direction §Verification (violates) | tsc clean; served HTML verified |
| 2026-10-14 | Raise change-card body and Addresses lines to full ink on the mint fill (11.2:1, per verdict-fill rule) | design-direction §3 | tsc clean; biome lint clean; served HTML verified |
| 2026-10-14 | Fix review findings: change-route failures return errors instead of withheld-with-zeros, shared compare pieces extracted, contract header covers titles/gaps | §6.9, §10 #4 | tsc clean; biome lint clean; 202/202 tests pass |
| 2026-10-14 | Redesign reach shelves as filled cards (same kind colors as flow side), their-N ranks, cites out, plain coverage line, per council verdict | §6.8 (§6.12 cites removed, same override) | tsc clean; biome lint clean; 200/200 tests; /demo serves fills with zero shelf cites |
| 2026-10-14 | Regroup reach picks into a 3-step playbook (Listen first, Find them, Fit in) with hedged verbs and kind labels intact | §6.8 | tsc clean; biome lint clean; 200/200 tests; /demo serves all three steps, old shelf grid gone |
| 2026-10-13 | Map /demo/result onto /flow results: idea card, surprise-conditional orange verdict, gaps card + change re-check bento, chatbot compare, evidence last | §6.7, §6.8, §6.9, §6.11, §6.12 | tsc clean; 202/202 tests; build pass; /api/compare + /api/flow/change live-smoked (429s degrade to honest withheld/empty states); /flow + /demo/result 200 |
| 2026-10-13 | Exclude hypothesis-neighbor controls from verdict ceiling with full-set fallback | §6.4, §6.7 | tsx 16 pass (4 new); tsc clean; biome clean |
| 2026-10-13 | Add AI word-bridge scoring: leftover words map to fetched tastes via strong/related/distant buckets at fixed 0.75/0.5/0 weights, max 4, pinned exact-only | §6.6, §7, §8 | node24 29 new + 46 affected pass; tsc clean; biome clean |
| 2026-10-13 | Remove v1 surface (run/case pages, propose+chatbot routes, runPipeline, propose seam, pitch-form family, v1 compare, case builder, run fixtures); /demo/result rewritten on flow components, header sample repointed | §5, §6.10, §6.11 | tsc clean; node24 211/211; biome clean; pnpm build pass with flow-only route table |
| 2026-10-13 | Rewrite product-spec to flow-only v2 (flow journey, Qloo-discovered rivals, pitch-aware ceiling, bridges, unwired-list, ship status); fix stale v1/script refs in run-flow and verdict comments | §5–§12, §14–15, App. B | tsc clean; biome clean; spec grep shows only the intentional historical note |
| 2026-10-13 | File distant-zero bridges under zeroTags instead of matchedTags so considered-but-counted-zero never reads as evidence | §6.6, §10 #4 | node24 82 pass (scoring+policy+flow suites); tsc clean; biome clean |
| 2026-10-14 | Switch OpenRouter fallback default to openrouter/free router (verified live: clean 4-bridge JSON first try) with 45s legs; retry without strict-JSON on validation 400s; token cap 1500; bridge fallback notes | §7, §11 | node24 216 + 33 pass; tsc clean; biome clean; live: or/free 4/4 valid, Groq 2/4 valid |
| 2026-10-15 | Add on-demand title check (POST /api/titles/check, click-only, run stays source of truth); strangers baseline sets the verdict line from bottom-of-ranking leftovers with genre-ceiling fallback; copy renamed (line=strangers, bars=other-genre groups) | §6.2, §6.4, §6.7 | node24 230/230; tsc clean; biome clean; pnpm build pass (new route in table); zero live calls (mocks only) |
| 2026-10-15 | Replace AI title suggestions with Qloo-derived ones (POST /api/titles/suggest, own-domain top-5 by tag overlap, empty-on-failure); tag call reads words + work type only | §6.1, §6.2, §7 | node24 237/237; tsc clean; biome clean; pnpm build pass (route in table); zero live calls (mocks only) |
| 2026-10-15 | Drop the verbatim-words rule: tag prompt asks for taste-describing words (with a heist-style example), fidelity kept as "nothing the pitch is not about"; add-word placeholder reworded | §6.5 | node24 extract-tags 6/6; tsc clean; biome clean |
| 2026-10-15 | Teach the tag prompt Qloo's vocabulary with real tag-shaped examples (criminal, small town, based on true story…) to lift match rates | §6.5 | node24 extract-tags 6/6; tsc clean; biome clean |
| 2026-10-15 | Show an honest empty note when title suggestions come back empty instead of hiding the section silently | §6.2 | tsc clean; biome clean |
| 2026-10-13 | Merge bridge + semantic impl/test pairs into single self-tested files (tests behind a main-entry guard, explicit tsx paths) | n/a | tsc clean; biome clean; tsx 211/211 (29 self-tests); next build pass; prod-import probe keeps env key, runs 0 tests |
| 2026-10-13 | Revert file merge: bridge + semantic back to separate impl and .test.ts files per owner request | n/a | biome clean on 4 files; tsc clean; tsx 211/211; next build pass |
