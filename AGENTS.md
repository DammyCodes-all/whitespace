# Agent guide

- Conventions: Server Components by default; add `"use client"` only when needed. Path alias `@/*` -> `src/*`. Instant nav by default.
- Spec: `docs/product-spec.md` is source of truth for product behavior. Check it when the task touches UX, scoring, verdict, copy, scope, or acceptance criteria. Cite the section (e.g. `§6.7`) in your answer/log. If spec is silent or unclear, flag it — don't invent behavior.
- Build log (required): after every code/build task, append one concise row to `docs/build-tracker.md` (`| Date (UTC) | What changed | Spec ref | Verify |`). Keep `What changed` to 1 line. Use `n/a` for Spec ref only if infra-only. Never skip.
- Docs: https://nextjs.org/docs
