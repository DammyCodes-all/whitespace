# Whitespace

> Before you ship, find out who it's actually for.

Whitespace is an agent that tells a creator which audience their idea fits, how
strongly, and where to find those people. Paste an idea — a film, an album, a
book, a game — and the app reads the words and the work type out of the pitch,
lets you confirm the words and name similar titles, then scores your named
audience plus rival audiences it discovers against ~20 unrelated control
audiences using [Qloo](https://qloo.com) taste data.

The result is a hypothesis, not a verdict on the work. Every number in it comes
from a recorded Qloo call, and every Qloo call is in the evidence drawer.

---

## What it does

1. **You paste an idea.** The work type (film / music / book / game) is detected
   from the pitch — there is no type selector anywhere in the product.
2. **You confirm the words.** The app proposes 5–8 descriptive words and shows
   each as a chip: matched to a real Qloo tag, or not found. You edit the set.
3. **You name your crowd.** You type at least one similar title. Titles are
   resolved live in Qloo; misses are reported as *not found* and never scored.
   Tap-to-add suggestions are seeded from the titles you typed, not from a model.
4. **The run scores.** Your named audience, rival audiences discovered from
   Qloo data, and ~20 control audiences are scored on one shared tag list.
5. **You read the verdict.** Strong / Mixed / Weak / Inconclusive, with the
   ranked audiences and their margins, plus a *reach plan* for any audience
   that clears the control line: interests, people, podcasts, brands, places.
6. **You compare.** The same pitch goes to a plain chatbot with no Qloo tools;
   its titles are marked *found* / *not found* in Qloo so you can see the
   difference the data makes.
7. **You check.** The evidence drawer lists every Qloo call of the run —
   request, response summary, status, cache hit.

## How the answer is computed

Short version; the full rules live in [`docs/product-spec.md`](docs/product-spec.md).

- **Ranking, not counting.** Qloo returns each audience's tastes in ranked
  order. Rank `r` of `N` scores `(N − r + 1) / N`; the raw strength values are
  discarded. Every audience is scored as a weighted mean over one shared tag
  list, 0 to 1.
- **No data is not a low score.** A tag missing from a long enough taste list
  (10+) is a **zero** — that audience does not over-index on it. A tag missing
  from a short or failed list is **no data** and is left out of the score
  entirely, so thin Qloo responses can never fake a low score.
- **A control line sets the bar.** A verdict is only *Strong* or *Mixed* if the
  top audience beats the strangers baseline (or, when that is unmeasured, the
  pitch-aware other-genre control ceiling) by the control margin (0.05).
- **Hold-out rounds break circularity.** The full-set score plus one round per
  gifting title rescore every audience on the same reduced set, so an audience
  that only wins on the titles it donated shows its own collapse next to the
  named row.
- **The AI points, our code scores.** Bridge weights are fixed in code
  (strong 0.75, related 0.5, distant 0), so the same words always give the
  same scores.

| Verdict | Meaning |
|---|---|
| Strong fit | The top audience clears control and is clearly ahead of the second |
| Mixed fit | The top two audiences both clear control and are close together |
| Weak fit | No audience clears control |
| Inconclusive | A guard fired (coverage, no-data, unjudgeable top, thin tags) — the app says why |

## Quick start

Requirements: **Node 22+** (Node 24+ to run the test suite) and **pnpm 12**
(`corepack enable` if pnpm is not installed).

```bash
git clone https://github.com/DammyCodes-all/whitespace.git
cd whitespace
corepack enable
pnpm install
cp .env.example .env.local   # add your keys
pnpm dev
```

Open <http://localhost:3000>. The app runs with no login.

### Environment variables

All variables are server-only (`.env.local` is gitignored). The Qloo key
travels in the `X-Api-Key` header and never reaches the browser.

| Variable | Default | What it does |
|---|---|---|
| `QLOO_API_KEY` | — | Qloo hackathon API key. Without it the app returns deterministic mock traces, so the UI still runs offline |
| `QLOO_BASE_URL` | `https://hackathon.api.qloo.com` | Qloo API base |
| `QLOO_TIMEOUT_MS` | `10000` | Per-request timeout |
| `QLOO_MAX_RETRIES` | `2` | Retries on 429/5xx and network errors |
| `QLOO_TAGS_PATH` | `/v2/tags` | Tag-search path |
| `QLOO_SEMANTIC_TAGS` | `on` | Second-chance meaning search for words the plain tag search misses (`off` to A/B coverage) |
| `GROQ_API_KEY` | — | Primary LLM provider (free tier) |
| `GROQ_MODEL` | `openai/gpt-oss-120b` | Groq model id |
| `OPENROUTER_API_KEY` | — | Fallback LLM provider |
| `OPENROUTER_MODEL` | `openrouter/free` | OpenRouter model id |

The LLM is only needed for reading the pitch into words, picking which
similar-title labels fit, pointing leftover words at fetched tastes, the
chatbot comparison, and rewriting reach prose. Without a key the run still
scores on exact Qloo matches.

### Offline / keyless mode

- No `QLOO_API_KEY` → every Qloo call returns a deterministic mock trace
  (`fromCache: true`), so the UI and the build work with no network.
- No LLM key → tag extraction and the chatbot comparison degrade to their
  honest empty states; the scored run still works on exact matches.
- [`/demo/result`](http://localhost:3000/demo/result) is a **static** sample
  result page built from fixtures. It makes no Qloo or AI calls and is the
  demo fallback if the network is down.

## Qloo calls used

Every live run is a fixed pipeline, in this order. All calls are `GET`.

| Endpoint | Used for | Key parameters |
|---|---|---|
| `/search` | Resolve a similar title to a Qloo entity; check titles on demand | `query`, `types`, `take` |
| `/v2/tags` | Match pitch words to real Qloo tags (scoped per work type) | `query`, `filter.tag.types` |
| `/v2/tags/search` | Semantic second pass for words the plain tag search misses | `query`, `filter.tag.types` |
| `/v2/insights` | Audience taste lists | `filter.type=urn:tag`, `signal.interests.entities`, `filter.tag.types`, `take` |
| `/v2/insights` | Rival-audience discovery (own domain first, then cross-domain) | `filter.type`, `signal.interests.tags` or `signal.interests.entities`, `take` |
| `/v2/insights` | Title suggestions seeded from the titles you typed | `filter.type`, `signal.interests.entities`, `take` |
| `/v2/insights` | Reach items: people, podcasts, brands, places | `filter.type`, `signal.interests.entities`, `filter.exclude.entities`, `take` |

Pipeline order: scope gate → cheap empty check → titles resolve (≥1) → named
tastes + rivals → controls → tag pool + pool gate → hold-out rounds → scores →
verdict → reach plan (only if control is cleared) → reach prose → chatbot
comparison.

Control audiences (~20 fixed other-genre seeds per domain) are resolved once
and cached for 30 minutes, so repeat runs cost far fewer calls. A run is capped
at 150 network calls; a quota breach fails loudly instead of degrading into
fake "no data".

## Grounding check

The product promise is that nothing is invented. Here is how to check it on any
run:

1. **Open the evidence drawer** on the result page. Every Qloo call of the run
   is listed with its endpoint, parameters, status, duration, whether it came
   from cache, and a response summary.
2. **Every title came from `/search`.** Titles you typed are resolved live;
   a title that does not resolve is shown as *not found* and is never scored.
3. **Every tag came from `/v2/tags`.** Matched chips show the Qloo tag name
   next to your word (`lonely → Loneliness`). Unmatched words appear as
   *not found* chips and never enter scoring.
4. **Scoring is code, not the model.** The model may only read the pitch into
   words, filter which title labels fit, point a leftover word at an
   already-fetched taste id, write the chatbot answer, and rephrase the reach
   prose. It never invents a tag, title, score, audience or reach entity, and
   it never ranks anything.
5. **Reach prose is validated.** The model may only rephrase names, ranks and
   gap labels that were measured in that run. Validation rejects unknown
   names, new numbers, rank drift and speculative relationships, and the
   section falls back to a deterministic draft built from the same facts.
6. **Missing data reads as missing.** Qloo's empty answers appear as "no
   data" and are excluded from the score — they never stand in for a low
   score.

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Dev server on <http://localhost:3000> |
| `pnpm build` / `pnpm start` | Production build and serve |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm check` / `pnpm lint` | Biome lint + format check |
| `pnpm check:write` / `pnpm format` | Biome autofix |
| `pnpm test` | Full test suite (Node 24+, native TS type stripping) |

## Repository layout

```
src/app/            routes: entry (/), run (/flow), static sample (/demo/result), API routes
src/components/     UI: entry, flow steps, result, reach card, chatbot comparison, evidence drawer
src/lib/qloo/       Qloo boundary: client (auth/retry/cache/quota), titles, tags, tastes, rivals, controls, related
src/lib/agent/      LLM seam: tag extraction, title-label pick, bridges, chatbot answer, reach prose
src/lib/flow/       the run pipeline, contracts and view models
docs/               product spec, coverage notes, design direction, build log
```

## Limits and non-goals

- It does not predict revenue, success or audience size, and it does not know
  how many people are in an audience.
- It uses aggregate taste data only. No personal data is collected or used.
- It does not replace user research — the output is a hypothesis.
- Film and music are the covered domains. Book and game are detected and
  runnable, but their taste data is thin in the Qloo hackathon dataset, so
  they are on hold.
- The name means *the audience you did not know your work fit*, not an empty
  market.

## License

MIT — see [LICENSE](LICENSE).
