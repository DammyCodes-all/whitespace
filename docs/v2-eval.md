# V2 human evaluation (§7)

Date: 2026-10-10. Pack: `src/lib/fixtures/v2-pitch-pack.ts` (9 invented
pitches, no Qloo output). Qloo endpoint success alone is not a quality
test — the reviewer judges brief fidelity, bridge usefulness, and
whether exploration mode is worth anything to a creator.

## Procedure

1. Start the app locally (`pnpm dev` or `pnpm build && pnpm start`).
2. Run the pack runner from /tmp (never in the repo — raw payloads
   stay private):
   `node /tmp/opencode/v2-pack-run.mjs` (POSTs each pack entry to
   local `/api/analyze`, writes aggregates to
   `/tmp/opencode/v2-pack-results.json`).
3. For each entry, open the saved `runId` in `/analyze` (replay, no
   new spend) and fill the checklist below.
4. Record latencyMs + httpAttempts per entry in the cost table.

## Per-pitch checklist

| Pitch | Interpretation exact? | References correct works? | Bridges useful (confirm / reject)? | Hypotheses or exploration useful? | Verdict |
|---|---|---|---|---|---|
| familiar-genre | | | | | |
| mixed-genre | | | | | |
| tone-led | | | | | |
| explicit-negation | | | | | |
| unusual-format | | | | | |
| vague-idea | | | | | |
| nonsense | | | | | |
| misleading-comparison | | | | | |
| reference-ambiguity | | | | | |

## Synthetic failure review (no humans needed — in the suite)

- Brief failure → unable-to-assess/unavailable (`run.test.ts`).
- Retrieval failure with surviving evidence → partial states.
- Ambiguity → needs-clarification, discovery held back.
- Budget exhaustion / deadline → fail-closed limitations.
- Double explanation failure → deterministic labels.
- Replay: saved result reloads byte-identical (`v2-store.test.ts`).
- Concurrency: two simultaneous runs keep independent ledgers.

## Cost table (§7 time/cost)

| Pitch | latencyMs | httpAttempts | llmCalls | Notes |
|---|---|---|---|---|
| | | | | |

Gate: typical path stays within the 90s budget and the 40-attempt
ceiling with headroom for explanation + reach.

## Adoption gate

Promote v2 as product behavior (spec §10 adopted) only when: brief
fidelity holds across the pack, misleading comparisons never leak
into evidence, nonsense never becomes a brief, and exploration-only
reads as useful starting points rather than filler. Qloo success
rates do not count toward this gate.
