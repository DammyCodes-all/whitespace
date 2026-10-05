# Agent guide for this Next.js repo

- Stack: Next.js 16 (App Router, `src/app`), TypeScript, Tailwind CSS v4, Biome.
- Commands: `npm run dev`, `npm run build`, `npm run typecheck`, `npm run check`, `npm run check:write`.
- Lint/format: Biome (`biome.json`). Run `npm run check:write` after edits. No ESLint.
- Styling: Tailwind v4 (`@import "tailwindcss"` in `src/app/globals.css`). Prefer utility classes, `cn()`-style composition.
- Conventions: Server Components by default; add `"use client"` only when needed. Path alias `@/*` -> `src/*`.
- Docs: https://nextjs.org/docs
