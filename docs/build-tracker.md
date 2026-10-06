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
