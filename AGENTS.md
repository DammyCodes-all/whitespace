# Agent guide

- Conventions: Server Components by default; add `"use client"` only when needed. Path alias `@/*` -> `src/*`. Instant nav by default.
- Spec: `docs/product-spec.md` is source of truth for product behavior. Check it when the task touches UX, scoring, verdict, copy, scope, or acceptance criteria. Cite the section (e.g. `§6.7`) in your answer/log. If spec is silent or unclear, flag it — don't invent behavior.
- Build log (required): after every code/build task, append one concise row to `docs/build-tracker.md` (`| Date (UTC) | What changed | Spec ref | Verify |`). Keep `What changed` to 1 line. Use `n/a` for Spec ref only if infra-only. Never skip.
- Docs: https://nextjs.org/docs, https://docs.qloo.com/reference/qloo-llm-hackathon-developer-guide

- Always write modular code.. no file should be too bulky

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
