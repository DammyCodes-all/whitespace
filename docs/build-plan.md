# Whitespace build plan: 10 build days, then harden

Ten working days, Oct 6 to 17. After that no new features. Oct 19 to 29 is polish and demo hardening only. Spec is `docs/product-spec.md` (§12, §6, §10).

## Ownership

Each dev stays in their own files. That is the whole trick.

| Dev | Owns |
|---|---|
| Q, Qloo data | `src/lib/qloo/**`, `src/lib/fixtures/**`, `docs/qloo-*.md` |
| S, scoring core | `src/lib/scoring/**`, `src/lib/policy/**`, `src/lib/pipeline/**`, `src/lib/types.ts` (frozen after Day 1) |
| U, agent and UX | `src/app/**`, `src/components/**`, `src/lib/demo/**`, `src/lib/case/**` |

The join point is `runPipeline()` in `src/lib/pipeline/run.ts`, owned by S. Q exposes functions, U calls the seam. If you are blocked, build against `src/lib/fixtures/` and keep moving. Do not edit someone else's files.

`WAIT:` means that day's work needs to land first. Do fixture-backed work until it does.

U's Day 1 mock run page (`src/app/run/page.tsx`) already renders the run-steps view, the verdict, the ranked list with no-data flags, and the evidence calls inline on mocks. Day 3 to Day 5 lift those into their planned components instead of building from scratch, since the shapes are frozen in `src/lib/types.ts`; Day 5 still owns the drawer interaction the mocks lack. The Day 6 seam swaps the data source, not these views.

## Week 1: pipeline end to end

### Day 1: contracts
| Dev | Task | Files | Depends |
|---|---|---|---|
| Q | Qloo client stub plus env plus retry | `src/lib/qloo/client.ts` | None (§8). Blocks Day 2 Q |
| S | Shared types and function signatures, then frozen | `src/lib/types.ts` | None (§7). Blocks everything, so land it first |
| U | Shell plus instant nav plus `/run` skeleton on mocks | `src/app/**` | None (§5) |

### Day 2: hypothesis input (§6.1, §6.2)
| Dev | Task | Files | Depends |
|---|---|---|---|
| Q | Title and tag lookup plus not-found list | `src/lib/qloo/resolve.ts` | WAIT: Day 1 S types |
| S | Overlap rule (over a third overlap means replace, up to 5 builds) plus tests on fixtures | `src/lib/scoring/overlap.ts` | WAIT: Day 1 S types only, not live Qloo |
| U | Pitch form plus similar-to confirm | `src/app/page.tsx`, `src/components/pitch-form.tsx` | WAIT: Day 1 S types only, data from fixtures |

### Day 3: tastes and score (§6.6)
| Dev | Task | Files | Depends |
|---|---|---|---|
| Q | Audience tastes fetch | `src/lib/qloo/tastes.ts` | None, fixtures first |
| S | Fit score 0 to 1, rank-normalized, pinned tags count double, zero versus no-data | `src/lib/scoring/fit.ts` | WAIT: Day 1 types; fixtures, not live Qloo |
| U | Run-steps view on fake stream | `src/components/run-steps.tsx` | WAIT: Day 1 types only (§5.4) |

### Day 4: rivals and verdict (§6.3, §6.7)
| Dev | Task | Files | Depends |
|---|---|---|---|
| Q | Rival retry and replace, drop what does not resolve | `src/lib/qloo/rivals.ts` | WAIT: Day 2 Q resolve |
| S | Control test plus verdict (Strong, Split, Weak, Inconclusive) plus margins stub | `src/lib/policy/verdict.ts` | WAIT: Day 3 S fit signature |
| U | Verdict plus ranked list plus no-data flags | `src/components/verdict.tsx`, `ranked-list.tsx` | WAIT: Day 4 S verdict shape, render fixtures until merged |

### Day 5: controls and honesty (§6.4, §6.5, §6.12, §8)
| Dev | Task | Files | Depends |
|---|---|---|---|
| Q | 20 controls plus coverage test (film versus music, pick domain) | `src/lib/qloo/controls.ts`, `docs/qloo-coverage.md` | None (§11). Feeds hardening calibration |
| S | Exclusion subtract plus grounding check plus coverage reporting | `src/lib/scoring/exclusion.ts`, `src/lib/policy/grounding.ts` | WAIT: Day 1 types; fixtures (§8) |
| U | Evidence drawer plus saved-run store | `src/components/evidence.tsx`, `src/lib/demo/store.ts` | WAIT: Day 2 Q call shape; fixtures until merged (§10 #8) |

## Week 2: reach, change, case, compare

### Day 6: seam (the one dependent day)
| Dev | Task | Files | Depends |
|---|---|---|---|
| Q | Freeze function signatures, `index.ts` export only | `src/lib/qloo/index.ts` | None |
| S | Wire `runPipeline()` from Qloo to score to verdict on fixtures | `src/lib/pipeline/run.ts` | WAIT: Day 2 to Day 5 Q and S functions. Blocks Day 7 to Day 10 |
| U | Wire run page to seam plus saved-run fallback | `src/app/run/page.tsx` | WAIT: Day 6 S seam merged that morning |

### Day 6.5: LLM proposals plus live wiring (the missing seam)
| Dev | Task | Files | Depends |
|---|---|---|---|
| U | LLM seam: Groq primary plus OpenRouter fallback, server-only propose step for similar titles, candidate words, 3 rival readings (JSON only, grounded downstream) | `src/lib/agent/propose.ts`, `.env.example` (`GROQ_API_KEY`, `OPENROUTER_API_KEY`) | WAIT: Day 6 S `PipelineInput` shapes (§7, §6.2/§6.3/§6.5) |
| U | Form to run wiring: home pitch posts to `/run` through propose plus confirm, replaces demo-input hardcode | `src/app/page.tsx`, `src/app/run/page.tsx` | WAIT: LLM seam above (§6.1) |
| Q | Run coverage test live and lock demo domain, film versus music | `docs/qloo-coverage.md` | API key present (§11, §6.4). Blocks Day 10 S margins |

### Day 7: reach plan (§6.8)
| Dev | Task | Files | Depends |
|---|---|---|---|
| Q | Related items (podcasts, people, brands, places, 5 each, dedupe user titles) | `src/lib/qloo/related.ts` | None |
| S | Gap finder (what the audience loves that the pitch lacks, no copy-writing) | `src/lib/scoring/gaps.ts` | WAIT: Day 6 seam shapes |
| U | Reach UI with source links | `src/components/reach.tsx` | WAIT: Day 7 Q shape, fixtures first |

### Day 8: change and re-check (§6.9, §10 #5)
| Dev | Task | Files | Depends |
|---|---|---|---|
| Q | Demo fixture pack (3 to 4 pitches) plus quota and cache guard | `src/lib/fixtures/*.json` | None (§9) |
| S | Change bar (rise clears bar, coverage holds, tags grounded, still clears control) plus withhold reason, then proposal | `src/lib/policy/change.ts`, `src/lib/pipeline/change.ts` | WAIT: Day 7 S gaps |
| U | Change UI (before and after plus withheld state) | `src/components/change.tsx` | WAIT: Day 8 S bar shape, fixtures first |

### Day 9: case and chatbot (§6.10, §6.11)
| Dev | Task | Files | Depends |
|---|---|---|---|
| Q | Chatbot title-mark helper (found or not-found through resolve) | `src/lib/qloo/mark.ts` | WAIT: Day 2 Q resolve |
| S | Inconclusive rules (coverage floor, no-data counts) | `src/lib/policy/verdict.ts` (own file) | None (§6.7) |
| U | Audience case one-pager (printable, footer disclaimer) | `src/lib/case/build.ts`, `src/app/case/page.tsx` | WAIT: Day 6 seam; fixtures first |

### Day 10: ship end to end
| Dev | Task | Files | Depends |
|---|---|---|---|
| Q | Location call: ship or hide note plus thin-data guard | `src/lib/qloo/location.ts`, `docs/qloo-coverage.md` | None (§6.8; cut first per §12) |
| S | Record margins v1 in code | `src/lib/policy/verdict.ts` (own file) | WAIT: Day 5 Q coverage pick |
| U | Chatbot compare view plus trace links everywhere | `src/components/compare.tsx`, `src/components/evidence.tsx` (own files) | WAIT: Day 9 Q mark helper; fixtures first |

## Oct 19 to 29: polish and demo hardening

No new features. Stay in your own files. Freeze code Oct 26, rehearse, submit early (§12, §15).

- Circularity gate: 4 or more real pitches, top differs from hypothesis at least sometimes, else stop and review the design (§10 #3). S plus fixtures from Q.
- Grounding: 20 runs, every title and tag came from Qloo (§10 #1). S. Nonsense pitches return Weak or Inconclusive (§10 #2).
- No-data never renders as a low score (§10 #4). A withheld change names the failed condition (§10 #5). S and U.
- Speed: 90s live, 10s saved. Repeatability: same pitch gives same verdict (§10 #6, #7). Q and S.
- Saved runs: 3 to 4 pitches plus 1 inconclusive plus 1 withheld change (§9). U on locked margins.
- Loads with no login, public repo, README covers setup, Qloo calls, grounding (§10 #9, §15). U.
- Cut in this order if it slips: city map, second domain, multi-limit re-score (§12).

## Daily

Pull. Ship your cell. Run `pnpm check && pnpm typecheck && pnpm build`. Add one row to `docs/build-tracker.md` with the spec section.
