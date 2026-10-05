# Agent guide for this Next.js repo

- Stack: Next.js 16 (App Router, `src/app`), TypeScript, Tailwind CSS v4, Biome.
- Commands (pnpm): `pnpm dev`, `pnpm build`, `pnpm typecheck`, `pnpm check`, `pnpm check:write`.
- Lint/format: Biome (`biome.json`). Run `pnpm check:write` after edits. No ESLint.
- Styling: Tailwind v4 (`@import "tailwindcss"` in `src/app/globals.css`). Prefer utility classes, `cn()`-style composition.
- Conventions: Server Components by default; add `"use client"` only when needed. Path alias `@/*` -> `src/*`.
- Docs: https://nextjs.org/docs
