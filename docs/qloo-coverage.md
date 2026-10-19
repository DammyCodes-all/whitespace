# Qloo coverage test (Day 5 Q, run live Day 6.5 Q)

Decides the demo domain by data, not preference (spec §11, §6.4, plan Day 5).
Film and music were the likeliest candidates; the live run below picks
**film** (both clear the gates; film wins on demo-story fit, §6.10 App. A).

## Status: RUN 2026-10-06 (hackathon Qloo, key in `.env.local`)

## Protocol results

Per-domain, live (`buildControls` 20 seeds × 3 titles; `fetchAllAudienceTastes`
on kept controls with `MIN_TASTES_FOR_JUDGEMENT=10`; `resolvePitchTags` on 10
probe words; one full `runPipeline` with 20 controls for quota):

| Domain | Resolve rate | Tastes ≥ 10 share | Tag match (unscoped) | Tag match (scoped) | Calls/run | Pick? |
|---|---|---|---|---|---|---|
| film | 20/20 (1.0) | 20/20 (1.0) | 10/10 | 8/10 (`slow-burn`, `cozy` no-data) | 99 | **yes** |
| music | 20/20 (1.0) | 20/20 (1.0) | 10/10 | 8/10 (`slow-burn`, `cozy` no-data) | 98 | no (viable backup) |

Both clear the 50% tastes-depth gate, so no design stop was needed. Film is
picked because the spec demo story is a film pitch (App. A), the film tag
scope (`genre:media` + `keyword:media`) got the deeper probe, and mood-word
pitches are film-shaped. Music stays a viable second domain.

## Integration fixes the run forced (all in `src/lib/qloo/`)

1. **Tastes: `filter.type=urn:tag` is required.** Without it the API silently
   ignores `signal.interests.entities` and returns empty lists (docs: Taste
   Analysis). All 20 tastes failed before, 50/50 tags after.
2. **Tags: the query param is `filter.query`, not `query`.** Bare `query`
   400s; `/v2/tags/search` 404s. See Search Tags reference.
3. **Tastes and tag resolve must scope to the same namespaces.**
   Unscoped tastes return cross-domain noise (credit-card and restaurant
   tags for movie sets), and unscoped resolve matches cross-domain names
   (`slow-burn` → `specialty_dish:place`). Per-domain scopes live in
   `src/lib/qloo/tag-scopes.ts` (film `genre:media`+`keyword:media`; music
   `genre:music`+`keyword:media`); both `tastes.ts` and `resolve-tags.ts`
   take an optional `workType` and stay unscoped without one (tests).
   Scoped probe: sci-fi set ranks `science_fiction` top-5, romcom set
   omits it; pop set ranks `pop` #1, ambient set ranks `ambient` #2.

## Discrimination check (film, genre-worded pitch)

With candidate words `science-fiction, fiction, drama, space, future,
solitude`: coverage 1.0, hyp 0.156 (matched `science-fiction`), rivals 0,
best control 0.122, verdict Weak (margin vs control 0.035, grounding ok).
The machinery separates fit from noise; margins calibrate on real pitches
in Day 10 (§6.7). Repeatability: the demo input ran twice live, same
verdict and scores (§10 #7).

## Findings for Day 10 calibration (not fixed here)

- **Exclusion subtract flattens generic matches.** Demo `nothingLike`
  "Fast franchise action" fuzzy-resolves to Fast & Furious 6, whose tastes
  include `genre:media:fiction`; subtraction then removes `fiction` from
  every audience. Spec §6.6 flags exactly this: if it behaves badly, fall
  back to an overlap warning. Test on real pitches before locking.
- **Mood words rarely intersect top-50 tastes.** `solitude`/`quiet` match
  real tags but no tested audience over-indexes them; genre words carry the
  score. The Day 6.5 propose prompt already asks for genre/mood/setting
  words — weight toward genre/theme when calibrating.
- **Demo `nothingLike` should be concrete titles.** A descriptive phrase
  ("Fast franchise action") resolves fuzzily and distorts exclusion; Day 8
  fixtures must use real titles.

## Margins v1 (set 2026-10-09, live)

`CONTROL_MARGIN` 0.1 → **0.05** in `src/lib/policy/verdict.ts`
(`SPLIT_MARGIN`/`SURPRISE_MARGIN` stay stubbed: no live Split or
surprise observed yet). Basis, all live on hackathon Qloo, film:

| Input (words) | Top | Best control | Gap |
|---|---|---|---|
| space, mid-specificity (alien/survival/dystopia/scientist, alien pinned) | hyp 0.744 | Sci-fi epic 0.644 | **0.100** |
| space, broad genre (science-fiction/fiction/dystopia/space) | rival-amb 0.488 | Horror 0.488 | 0.028 |
| horror, mid-specificity (horror/folk-horror/grief/ghost) | hyp 0.160 | Fantasy 0.180 | -0.020 |
| Day 8 pack, all 4 entries (mood-level words) | — | — | 0 (all zeros / Inconclusive) |
| user space pitch, same 4 words + auto-expansion | hyp 0.360 | Horror 0.262 | **0.098 → Strong** |

0.05 sits between observed noise (≤0.03) and observed signal (0.10).
Companion fixes shipped the same day: tag resolve prefers the
namespace variant audiences hold (pipeline resolves tags after tastes);
propose caps words at 4–6, genre/theme/setting-led (`src/lib/agent/propose.ts`).
With the bar at 0.05 the space run above returns **Strong** (top hyp,
no surprise — the guess was right).

## Day 11 fixes (shipped 2026-10-09, live-verified)

1. **Scope gate** (`src/lib/policy/scope.ts`, `src/components/scope-notice.tsx`):
   telegram-bot pitch now returns Inconclusive with reason `scope` and zero
   Qloo calls instead of a fake all-zeros Weak. Rule: tool-creation or
   utility-behavior signal without creative-work framing. A film ABOUT a
   bot stays in scope (framing wins).
2. **Concept audience** (`src/lib/qloo/concept.ts`): `signal.interests.tags`
   on `/v2/insights` verified live (sci-fi tag signal → 200, tag affinities).
   Scored as a contender beside movie-fan audiences. Live: space run stays
   **Strong** (hyp 0.360 vs Horror 0.262) with concept at 0.000 — the idea
   gets tested without circularity inflation. Horror run: concept no-data
   (short list), verdict unchanged Weak.
3. **Show the guess**: confirm panel now states hypothesis titles, rival
   readings, and words with "is that your crowd?" before the run.

## Day 10 Q status (2026-10-06)

1. **Location call: ship the guard, hide the map.** No live key in the
   working tree for a city probe, and the hackathon developer guide
   lists no city-concentration signal or filter for `/v2/insights` —
   so `src/lib/qloo/location.ts` ships the §6.8 thin-data guard
   (`MIN_PLACES_FOR_MAP = 5`), but `fetchLocation` fails closed and always returns `hidden` with a
   machine-readable reason until a verified city-scoping parameter
   exists. The map UI stays unwired; per §12 city map is cut first, so
   "hidden with reason" is the shipped state, not a TODO. When a key
   verifies a real city filter, the candidate-word probe is:
   `/v2/insights?filter.type=urn:entity:place&signal.interests.entities=...`
   plus the city filter — if results do not attribute to the city,
   keep hiding.
2. **Margins v1 stay stubbed.** No live key is available in this
   working tree, so the §6.7 calibration protocol has not run. The
   protocol is ready: run 4+ pitches (the Day 8 pack) through
   `runPipeline` in one process — the new cache and quota guard
   (§11) make the call counts meaningful — and record the observed
   hypothesis-vs-control and hypothesis-vs-rival margins as S's
   constants in `src/lib/policy/verdict.ts`. Until a key lands, the
   tracker row must not claim margins are set; `verdict.ts` keeps its
   explicit stub comments (§6.7: exact margins are decided week 1 on
   real pitches, they are not findings).
3. **`resetQuota()` per run** is wired (teammate, same day): the
   pipeline resets the quota counter at the start of each live run so
   the 150-call cap is per-run, not per-process.

## Seeds

`CONTROL_SEEDS` in `src/lib/qloo/controls.ts`: 20 genre-spread controls
for film and music, 6 fallbacks for book and game. Seeds are famous,
pre-2026 titles chosen so Qloo is likely to hold them; misses are
expected signal, not errors. Live: film and music both resolved 20/20.

## V2 capability pilot (2026-10-10, live)

Bounded §8 gate check for `docs/pipeline-redesign.md`. Ten live HTTP
calls, aggregates only — no response payloads are stored in this repo
(hackathon guide: private caching only, never commit Qloo data).
Raw output stayed in server-local temp; only counts and conclusions
below are public.

Protocol: resolve 2 film lenses (`/search`, exact-name match), then
`GET /v2/insights` with `signal.interests.entities=<lens id>` into
`urn:entity:movie` + `urn:entity:book` at `take=20`. Pairs tested:
Interstellar×Moonlight (far), Interstellar×Dune, Interstellar×Blade
Runner 2049, Her×Moonlight (near). Depth sweep take=20/50/100 on the
close pair; exclude-filter check; book-seeded podcast/person reach;
unknown-param check; repeat-query stability.

Findings (all 200s):

1. **Identity:** exact-name match beat the first hit on every resolve
   (5 candidates each). `/search` hits carried no usable type info
   (null), so name+alias matching plus the `types` request param is the
   identity signal — never first-hit acceptance.
2. **Discovery works:** movie and book categories each returned a full
   page (20/20) with entity metadata (`entity_id`, name, type/subtype,
   properties, popularity, tags on 18–20/20, external links).
   `take` honored at 20 and 50. `take=100` returned **zero** results —
   treat ~50 as the practical page cap, not an error.
3. **Overlap is sparse (the gate result):** entity overlap between two
   lenses was **0 at top-20 in every pair and category**, including
   near pairs (Interstellar×Dune, Interstellar×BR2049), and still 0 at
   take=50. Shared *tag* vocabulary is large (~900–1300 shared tags of
   ~3500–4200 per set) but generic. Per §8 this is a stop/revise
   signal: entity-overlap grouping will usually yield zero supported
   neighborhoods, so the honest first release is **reference-led
   exploration**, not fabricated discovery.
4. **Exclusion honored:** `filter.exclude.entities` removed both the
   seed and a planted result id (re-query returned 20 without them).
5. **Reach from non-film seeds works:** 3 book ids seeded podcast and
   person queries (5/5 each, all with tags). Artist as a discovery
   fallback also returns 20/20 with tags.
6. **Silent ignoring confirmed:** an unknown query param returned 200
   with identical counts — a 200 alone never proves a signal was
   honored. Repeat queries are deterministic (20/20 identical), which
   keeps client-side replay honest.

Decision: build the lean MVP (2 discovery lenses × 2 categories,
overlap-only grouping, `explorations` fallback; supporting lens,
reach, detail enrichment, comparison overlay deferred). Zero
neighborhoods is a valid result, not a failure.

## Flow-path live Strong hunt (2026-10-11, hackathon Qloo)

Six sharp-genre film pitches through `runFlowPitch` (6 hand-matched
tags each — tag probe 36/36 matched at coverage 1.0; 3 famous similar
titles each). First run cost 90 calls, runs 2–6 ~87 with ~80 cached
(controls cached after run 1, per design).

| Pitch (tags) | Top | Ceiling | Gap | Verdict |
|---|---|---|---|---|
| cyberpunk (cyberpunk/android/hacker/neon/dystopia/robot; BR2049/Matrix/Ghost in the Shell) | Named 0.26 | 0.15 Blockbuster action | **+0.11** | **Strong** |
| space-survival (alien/survival/dystopia/scientist/space/future; Interstellar/Arrival/Martian) | Named 0.19 | 0.28 Sci-fi epic | −0.09 | Weak |
| mystery-noir (mystery/detective/murder/suspense/secret/noir; Se7en/Gone Girl/Knives Out) | Named 0.14 | 0.16 Crime | −0.03 | Weak |
| folk-horror (horror/ghost/witch/curse/grief/isolated; Hereditary/Witch/Midsommar) | Named 0.08 | 0.30 Fantasy | −0.22 | Weak |
| heist-crime (crime/heist/betrayal/robbery/undercover/crew; Heat/Ocean's Eleven/Inside Man) | Named 0.00 | 0.15 Documentary | −0.15 | Weak |
| western-revenge (western/revenge/outlaw/frontier/showdown/gunfighter; Unforgiven/True Grit/No Country) | Named 0.00 | 0.09 Thriller | −0.09 | Weak |

Findings:

1. **First live reach plan with real data** (cyberpunk Strong):
   interests (Classics, mature animation, military, alien,
   surrealism) plus 5 people, 5 podcasts, 5 brands, 5 places. The
   runner-up is a genuine film rival (Fans of Mute, 0.10), no
   surprise (top is the named audience).
2. **Cross-domain book/artist rivals never contend** (0–0.15,
   usually ~0.06 or 0): their taste vocabularies barely intersect
   film tags. Split and surprise remain test-only; both need rival
   scores near the named score, which this discovery path rarely
   produces.
3. **Folk-horror and mystery-noir discovered zero rivals** (all 3
   domain calls same status) — rival absence is honest (run
   continues, verdict Weak) but narrows those runs to hyp-vs-ceiling.
4. **Heist/western named scored flat 0.00** despite famous titles
   resolving 3/3 — tastes hold none of those tag ids at take=50.
   Either the tag namespaces genuinely miss those audiences or the
   taste depth is thin there; worth one targeted probe before
   trusting 0.00 as "doesn't care" (§10 #4).

## LLM-path re-run (2026-10-12, hackathon Qloo)

Same 6 pitches, no hand-picked anything: `extractPitchTags` (words +
type + suggested titles) → `resolvePitchTags` → `runFlowPitch` with
all suggested titles as similar-to. One process, controls cached.

| Pitch | LLM words (matched/not-found) | Suggested titles | Verdict | vs hand-tagged hunt |
|---|---|---|---|---|
| cyberpunk | cyberpunk/hacker/android/rogue/neon/dystopia 6/6 | Blade Runner, Matrix, Ghost in the Shell, RoboCop | **Strong** + reach | holds |
| space-survival | alien/crash/scientist/station/survival/dystopia/colony 7/7 | Martian, Gravity, Alien | Weak | holds |
| mystery-noir | detective/murder/killer/city/shadows/secret/hidden/noir 8/8 | Chinatown, L.A. Confidential, Maltese Falcon | **Strong** + reach | flips (was Weak −0.03) |
| folk-horror | witch/curse/ghost/island/village/grief 6/6 | Witch, Wicker Man, Midsommar, Others | Weak | holds |
| heist-crime | crime/heist/robbery/betrayal/undercover/crew 6/7 (`cop` no-data) | Heat, The Town, Inside Man | Weak, 0 rivals | holds |
| western-revenge | western/outlaw/frontier/showdown/gunfighter/brother/revenge/brutal 8/8 | Unforgiven, Outlaw Josey Wales, True Grit | **Strong** + reach | flips (was 0.00 Weak) |

Findings:

1. **Fixes work.** Coverage 1.0 on 5/6 (heist 6/7); suggestions all
    real, sensible titles; no stops, no vacuous runs — every run
    built a named audience from suggestions.
2. **Verdicts are word-choice sensitive.** Mystery-noir and western
    flip on LLM wording alone (8 concrete words vs 6 hand tags).
    The prompt fix is doing real work, but margins near ±0.05 will
    swing run to run — calibration needs word-set repeats, not just
    pitch repeats.
3. **Heist discovery still returns 0 rivals** (tag-seeded, all 3
    domain calls same shape). Run stays honest Weak via the named
    audience; the guard correctly does not fire when a hypothesis
    exists. Rival-seeding is parked per user call.

## Repeatability probe (2026-10-12, hackathon Qloo)

Cyberpunk x3, mystery-noir x5, full LLM path per run.

| Run | Words | Named | Ceiling | Gap | Verdict |
|---|---|---|---|---|---|
| cyberpunk 1 | cyberpunk/hacker/android/rogue/neon/corporate/dystopia | 0.083 | 0.000 | +0.083 | Strong |
| cyberpunk 2 | …/rogue/robot/neon/dystopia (no corporate) | 0.191 | 0.129 | +0.063 | Strong |
| cyberpunk 3 | …/rogue/neon/city/corporate (no dystopia/robot) | 0.083 | 0.103 | −0.020 | Weak |
| mystery 1 | detective/murder/killer/city/shadows/suspense | 0.127 | 0.163 | −0.037 | Weak |
| mystery 2 | …/shadows/secret (no suspense) | 0.133 | 0.163 | −0.030 | Strong (rival-led) |
| mystery 3 | +hidden (7 words) | 0.114 | 0.140 | −0.026 | Split |
| mystery 4 | 5 words, no secret/suspense | 0.160 | 0.196 | −0.036 | Weak |
| mystery 5 | identical to 4 | 0.160 | 0.196 | −0.036 | Weak |

Findings:

1. **Wobble is LLM-side.** Runs 4/5 with identical words repeat
    exactly — Qloo scoring is deterministic. Verdicts move because
    the word set moves (5–8 words, different picks per run).
2. **First live Split (mystery 3) and first rival-led Strong
    (mystery 2)** — Split/surprise are no longer test-only. Run 2
    needs the surprise flag checked: named loses, a rival clears.
3. **Cyberpunk 1 won against a 0.000 ceiling** — a Strong that beat
    nothing. Verify whether that 0 is judged or placeholder; if
    placeholder, the unjudged-control fix has a hole on this path.
4. **The UI confirm step mitigates all of this**: a human locks the
    word set before the run, so shipped wobble is smaller than probe
    wobble. Still, near-margin (±0.05) verdicts should read as
    provisional.

## Zero-ceiling verdict (2026-10-12, hackathon Qloo)

Repeat-probe cyberpunk run 1 won against a 0.000 ceiling. Instrumented
re-runs (3x, per-stage statuses + per-control scores): ceilings
0.1125–0.15, every call 200, zero nulls — the anomaly never recurred.

Verdict: a ~2-minute degraded Qloo window during that run's fresh
taste fetches (same window also zeroed its fresh rival tastes; later
runs in the same process were healthy). Not a scoring bug — scoring
was correct given degraded inputs. 14–16/20 controls at judged 0 is
NORMAL for niche tags, so the guard must trigger on
ceiling-is-0-with-empty-top-tagHits, not on "many zeros".

Fix queued (not built): all-zero opposition → provisional, never
Strong (§6.7, §10 #4).

## AI word-bridge scoring (2026-10-13, no live calls)

Why it exists: strict word-for-word scoring understates fit whenever
the pitch's language and Qloo's taste language sit at different
levels. Live symptom: heist/western runs scored flat 0.00 despite 3/3
titles resolving — the meaning was in the tastes, the exact tag IDs
were not. Mood/atmosphere pitches suffer most; genre-label pitches
suffer least. The older expansion retry (`space`→`Outer Space`) proved
a capped, labeled second chance can flip Weak to Strong with no new
Qloo calls; the bridge generalizes it to true semantic links
(`lonely`→`solitude`) that strict containment can never catch.

Locked rules (spec refs §6.6, §7, §8): the AI only points leftover
words at already-fetched taste ids plus a bucket — strong 0.75,
related 0.5, distant 0 (considered, not counted). Max 4 bridges per
run; pinned must-haves stay exact-only; buckets-only output or the
run continues on exact matches; AI failure falls back silently;
every bridge renders as `word→Tag (AI: bucket)`. Fixed weights live
in code, so the AI points and our code scores — determinism (§10 #7)
and grounding (§8, §6.12) survive. Acceptance bar: bridges must widen
gaps (right audience rises, wrong ones stay), never inflate everyone
together — re-check on the 6-pitch table.
