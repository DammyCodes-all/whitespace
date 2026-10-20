# Whitespace: product spec

Status: v2, flow-only. Rewritten 2026-10-13 after the v1 pipeline
(`/run`, `/case`, `/api/propose`, `runPipeline`, pitch form) was
removed. This document describes the shipped flow and nothing else.

Tagline: Before you ship, find out who it's actually for.

---

## 1. Summary

Whitespace is an agent that tells a creator which audience their idea fits, how strongly, and where to find those people.

A creator pastes an idea (a film, album, book, game or similar). The
app reads descriptive words and the work type out of the pitch, lets
the user confirm the words and name similar titles, then scores one
named audience plus Qloo-discovered rival audiences against ~20
unrelated control audiences using Qloo's taste data. It returns a
verdict on fit, a reach plan for winners, what the winner loves that
the pitch lacks, and a chatbot comparison that shows what Qloo added.
Every run records its Qloo calls; missing data reads as "no data",
never as a low score.

## 2. Problem

Every figure below is other people's research, cited in full in
`docs/impact-evidence.md`. None of it is a Whitespace measurement, and §4
still binds: the product never predicts size, reach or success.

### 2.1 The audience data exists — and it is locked away from the people who need it

Independent film operates outside the system that commissions the $192B US
film industry, and its audience research sits behind the same firms that sell
to it. The Harvard Kennedy School's Shorenstein Center, after surveying
14,421 US adults and combining that with Nielsen, Parrot Analytics and The
Numbers, put it plainly: *"Data is not publicly available to small
independent film businesses or independent creators, which puts this sector at
a disadvantage compared to the large, tech enabled businesses dominating the
US media."* The BFI found the same wall in the UK, where audience research on
individual titles was *"prohibitively expensive for independent
distributors"*.

### 2.2 The gap between interest and reach is measured, and large

The same Shorenstein study estimates a **76.3M** addressable audience for US
independent film against **36.7M** people who actually watched one in
2022–23 — roughly 40M in between. The shortfall is a discovery problem, not
an appetite problem: per-title viewing is low *"due to the lack of marketing
to bring attention to small titles"*, and 90% of Netflix viewers never leave
the home page to decide what to watch. The supply side tells the same story:
Nollywood produces roughly **2,500 films a year** (UNESCO), with no
comparable public audience data to match them against demand.

### 2.3 Creators already do the right thing — by hand

They are not sitting on this problem. The trade's own ritual is the input
Whitespace uses. Sundance's pitch deck guidelines require comparable films,
because *"a creative comp shows audience interest for your film (no
figures)"*. A comp is how the industry says "this is who it is for". What no
one gives a creator is what stands *behind* those comps — the audience,
measured against the audiences the same work could have reached instead.

There is a second reason the guess is hard to check by eye: taste, not
demographics, decides what people watch. In a peer-reviewed study of 3,204
viewers rating 209 films, NYU's Wallisch and Whritner found *"the industry's
targeting of film goers by broad demographic categories seems off the mark"*
— age and gender explained little agreement between viewers — and their
prescription was to slice audiences into **taste clusters**. Whitespace
compares audiences by taste against a control set because the research says
that is the axis that carries signal.

### 2.4 The cost of guessing wrong lands on people who can least afford it

**54%** of independent musicians name *"getting music heard"* as their
biggest challenge (Musician's Census 2024, n=300). Discoverability is the
single biggest barrier for **35.8%** of independent rappers (Rap Report 2026,
n=1,595), with ~70% naming discovery or promotion among their biggest
struggles. **74%** of 5,039 independent artists earned under $1,000 from
music in the past year (Ditto 2026). These three surveys are run by
companies that sell to artists — primary testimony from a biased sample, and
they agree on the ranking.

### 2.5 The gap Whitespace closes

The creator's guess stays; it just stops being the only guess. Whitespace
takes the *"similar to"* titles the creator already writes, scores the
audience behind them, discovers rival audiences from the same data, scores
both against unrelated control audiences, and says which one actually fits —
or says the evidence is not there. It never says how many people are in the
audience, and it never says the work will succeed.

### 2.6 What the evidence does not say

- The film figures are **US-only**, and the UK confirmation is a separate
  institution, not an extrapolation.
- The music figures come from **vendor-run surveys of their own users** —
  useful as testimony, not as a market size.
- None of it shows that creators *cannot* pick an audience, only that they
  cannot check the pick with data they do not have.
- None of it shows anyone will pay for this. See §3.1.

## 3. Users

User and buyer: the creator who chooses their own audience. Examples are an indie filmmaker, a musician, an author, a small game studio, or a restaurant concept owner. The creator uses the product directly and is the person it is built to serve.

Whether creators will pay has not been checked. Authors are known to pay for research tools (Publisher Rocket is one example), and artist-data tools like Chartmetric exist, but nobody on the team has asked creators in the chosen domain. The cheapest check is to show a sample result to three or four of them and ask what they would do the next morning.


## 4. Goals, non-goals and claims we will not make

Goals

1. Give the user a result they can act on: a named audience, a margin over the alternatives, and a concrete reach plan.
2. Make every run checkable through its recorded Qloo calls.
3. Say "no data" or "inconclusive" when that is the honest answer.
4. Show, on screen, what Qloo adds compared with a plain chatbot.

Non-goals

1. Predicting revenue, success or audience size.
2. Collecting or using personal data. Only aggregate taste data is used.
3. Replacing user research. The result is a hypothesis, not a verdict on the work.

Claims we will not make

1. That the tool predicts whether something will succeed.
2. That it knows how many people are in an audience. Qloo shows what an audience likes, not headcounts, as far as we know.
3. That a market is empty or unserved. The name Whitespace should be explained as the audience you did not know your work fit.
4. That anyone is using it or that buyers will pay.
5. That it closes the ~40M gap between the addressable and the actual audience for US independent film (§2.2). That gap is evidence the problem is real and worth money, not a promise about what the product does.
6. That the research in §2 is ours, or that the three music surveys describe the whole music industry. They are other people's studies of their own users, cited as such.
7. That creators are bad at picking an audience. The claim is that they cannot *check* the pick with data they do not have (§2.1).

## 5. User journey

1. The user types an idea into the plain entry box on the home page. Submit hands the pitch to a blank run page through an animated page move; the pitch box morphs into the dotted orb there and each leg plays its morph→think→resolve cycle, never on the landing page. Legs end quietly — no receipt cards: mid-run legs hold the orb with a "waiting for your input" nudge while the leg UI below takes over, and the scored run ends on the green flash before the result lands. The work type is detected, never picked. Opening the run page without a pitch (or with a blank one) returns to the landing page; there is nothing to run.
2. The app shows descriptive word chips (matched / not found in Qloo) under the circle, then asks for similar titles, shows entity-seeded suggestions on check, and finally the aggregated tag set for review. The user edits the words, taps titles to name their crowd, and confirms each step with Done / Continue.
3. The user watches the circle report each step in one honest line beneath it while the run scores.
4. The user sees the verdict, the ranked audiences with margins, and any "no data" flags.
5. The user opens the reach plan for a winning audience.
6. The user compares the result with a plain chatbot's answer, whose titles are marked found / not found in Qloo.
7. A static sample result is always available from the header with no login.

## 6. What it does

### 6.1 Input

The user provides a detailed explanation of the work — the input
placeholder prompts for premise, mood, themes and setting
(more detail means better tags) — and at least 1 similar title.
The tag call reads 5 to 8 descriptive words and the work type
(film, music, book or game — there is no type selector anywhere).
The AI suggests no titles: the tap-to-add suggestions are seeded
from your own typed titles (their Qloo entities, same type, one
call chained to your explicit Check — they never run off pitch
tags and never as-you-type), the user types the final list freely (× removes any
title), and an explicit Check button verifies each title against
Qloo before the run (one call per finished title — typing is free,
checking is on demand). The run re-resolves every title live and
reports misses as not found, so the pre-check is informational
and the run stays the source of truth. With no title the run
stays disabled: title-grounded tags need a title to ground in.
There is no "nothing like" input on the flow path.

One worked example is one click from the live landing: the demo
button beside the primary action loads the cyberpunk pitch and comps
that produced the Strong result in the 6-pitch hunt. It hands over the
pitch and its comparable titles; the titles arrive prefilled in the
titles leg and still go through Check and the run's own live
resolution. The demo creates no special path — same gates, same Qloo
calls, same evidence.

### 6.2 Named audience

The user-confirmed similar titles (at least 1) are resolved
live in Qloo (pre-checked on demand before the run, re-resolved
at run time). Resolved titles form the named audience; misses are
reported as not found, never scored. Each resolved title (up to 5)
gets its own taste fetch: those taste labels are the tag pool's
base, and each title gets a hold-out round (§6.6). Titles past 5
still join the hypothesis signal but get no hold-out round.

### 6.3 Rival audiences

Rivals are discovered from Qloo data alone, never proposed by
a model. Each rival is a real Qloo entity's fan base, named after that
entity, so the name is a fact. Discovery fills contenders to four
(fewer when Qloo returns fewer). Zero contenders — no titles and no
discovered rivals — stops the run as Inconclusive before any control
or taste call is spent.

The first attempt asks the graph with the pitch's matched tags: which
works match the creator's own words? That is the sharper question when
it works, but it is an intersection across every matched tag, and a
niche pitch can come back empty — not a missing catalog, a too-narrow
question. Live runs: 3 of the 6 probe pitches found zero rivals this
way (`docs/qloo-coverage.md`).

So when the first attempt answers and returns nothing, and the user
named titles, the agent asks the graph a different question — which
works are related to the titles you named? — and uses that answer
instead. One extra attempt (three domain calls), then an honest "no
rivals". The run steps and the result both say the plan changed, and
both attempts stay in the evidence drawer.

Neither a partial result nor a failure counts as an empty answer. Qloo
returning fewer rivals than asked for is allowed, and a call that never
answered is reported as an outage, not as "nothing related": a failed
request is not evidence that nothing matches.

### 6.4 Control audiences

About 20 fixed same-domain audiences (genre-spread seeds for film
and music; 6 fallbacks each for book and game) are resolved once and
their tag sets cached for 30 minutes; every pitch is scored fresh
against the cached sets. Seeds that resolve to nothing are dropped
and reported, never kept. A batch with no resolved controls (and a
set where every taste fetch failed) is not cached, so a failed seed
run cannot freeze the baseline for the TTL. They render as other-genre
groups: context bars, not the line. The verdict ceiling is the strangers
baseline: the bottom-unused entities of the same live discovery
ranking rivals come from (weakest overlap with the pitch, own
domain first), measured with one extra taste fetch and scored
identically. When strangers are missing or unmeasured, the ceiling
falls back to the pitch-aware control rule (a control that shares ANY
title with the named audience is excluded — it is not an unrelated
field when it holds the film under test; when every control is too
close, the full set comes back so the ceiling never vanishes), and the
step says which source set the line. The "any shared title" rule was
tightened on 2026-10-20 after the back-test: the Horror seed holds
"Get Out", so naming that film used to leave the subject film's own
crowd in the field as an independent baseline (`docs/backtest-results.md`).
The §6.3 rival rule (more than a third overlapping) is a separate rule
and does not change.

### 6.5 Tag pool (title-grounded)

Scoring tags come from the similars, never from the model. Base:
top taste labels off the similars' already-fetched tastes (Qloo
facts, zero new calls). Supplement: pitch words matched to real
Qloo tags in the detected type's namespaces (misses come back
`not_found` chips and never enter scoring). Minus generic: any
tag held by at least half the control taste lists. Tie rule: each
kept tag must tie to a pitch phrase or a named title (AI picks,
you confirm on one chip row with [pitch]/[title] source badges) —
untied tags drop. An empty title-gift preview names its reason
(no tastes for these titles, all gifts generic, or the read
failed) instead of one vague line. The result always shows coverage. A cheap
empty-check stops title-less, word-less runs for ~0 calls; the
real gate runs once on the combined pool — fewer than 3 pooled
tags stops the run as Inconclusive before scoring.

### 6.6 Scoring

Qloo describes each audience as a taste list ranked by strength. The
app keeps the order and discards the raw strengths (ranks only,
never counts): rank r of N scores (N − r + 1) / N. Each audience's
fit is the weighted mean across one shared tag list, 0 to 1. There
is no pinning on the flow path: every exact tag weighs 1.

Scores stay 0–1 in the pipeline. Every surface that shows one renders
it as a **fit index** out of 100 (rounded once at display), defined in
place as relative to the audiences measured in that run and explicitly
not a probability. No score is ever shown with a percent sign, and the
result headline never says "matches your idea". The targeting brief
carries the same definition, because a pasted brief travels without the
screen around it.

The circular fix is hold-out rounds: a full-set round plus one round
per gifting title, each round rescoring every audience — named,
rivals, controls, strangers — on the same reduced set. The verdict
uses full-set scores; hold-out deltas render beside the named row
(self-fit exposes itself as near-zero, real fit survives).

The hold-out rounds are also read as a fragility test (added
2026-10-20; why: `docs/backtest-results.md`, problem 2). The named
audience is **fragile** when a round drops it FURTHER than the same
round drops the field's best score — it leans on its own gifts more
than the field leans on that same removal. "The field" is the
contender field the hold-out ledger already reports: the named
audience and its rivals, best score first (the ledger's "top" row), on
the full set against the same reduced set. A gap smaller than one
point at the displayed precision (0.01) is display noise, not a
signal. The comparison is paired (same round, same reduced set), so it
needs no margin of its own, and it uses the rounds the run already
computes: no extra Qloo call, no extra scoring. A run with no hold-out
rounds is never fragile. A round whose scores could not be judged
carries no signal and is skipped — no data is never a zero — and when
more than one round is fragile the reason names the worst one.

A tag missing from a long enough list (10+ tastes) is a ZERO — the
audience does not over-index on it. A tag missing from a short or
failed list is NO DATA and is left out entirely, so thin Qloo
responses can never fake a low score.

AI word-bridges rescue meaning strict matching misses (added
2026-10-13; why: `docs/qloo-coverage.md`, "AI word-bridge
scoring"; default ON since 2026-10-15 per user call —
`BRIDGES_ENABLED=true` — exact matches plus leftover-word bridges).
Leftover words — pooled tags scoring zero everywhere —
get one narrow AI call pointing each at an already-fetched taste id
plus a bucket: strong 0.75, related 0.5, distant 0 (considered, not
counted). At most 4 bridges per run; buckets-only output or the run
continues on exact matches; AI failure falls back silently;
every bridge renders as `word→Tag (AI: bucket)`. A bridge target must
not already be in the scored pool (that would count the same signal
twice), and a weighted bridge held by no contender is dropped: it
could only grow every denominator and no numerator. The weights are
fixed in code: the AI points, our code scores. Same words always
give same scores.

### 6.7 Control test and verdict

An audience "clears control" when it beats the strangers baseline
(or the fallback other-genre ceiling when strangers are unmeasured)
by the control margin (0.05, Margins v1 2026-10-09; observed noise
≤ 0.03, signal ≈ 0.10). Only judgeable lines set the ceiling:
placeholder zeros never act as a floor.

| Verdict | Meaning |
|---|---|
| Strong fit | The top audience clears control and is clearly ahead of the second |
| Mixed fit | The top two audiences both clear control and are close together; also the ceiling a fragile named audience is capped at |
| Weak fit | No audience clears control |
| Inconclusive | Coverage or no-data guards fired, or the baseline itself was unmeasured |

Guards, all Inconclusive, never Weak: coverage below 0.34;
more than half the scores unjudgeable; an unjudgeable top; no
contenders; too few pooled tags; no titles; out-of-scope pitch;
a judgeable ceiling of exactly 0.00 (won against nothing — a real
Strong needs a real baseline); controls exist but none judgeable.

Fragility cap (added 2026-10-20; why: `docs/backtest-results.md`,
problem 2): a fragile named audience (§6.6) cannot read Strong fit.
The verdict is capped at Mixed fit and carries the reason with it —
which title was removed, what it did to the named audience and to the
field — in the run ledger, the targeting brief and the result card.
The reason rides on the result itself, so the card states the same
sentence the ledger and the brief carry. Silently downgrading is not
allowed; a capped verdict never travels without its reason. The
ranking and the scores are untouched: only the verdict word changes,
and the reach plan stays with the top audience (the runner-up never
cleared control, so §6.8 gives it no reach plan and the run spends no
extra call). The cap applies to the named audience's own verdict: when
a rival is the top audience, the verdict is about that rival's
measurement and is not capped. A verdict that is not Strong is not
capped either — there is no strong claim to correct, and the hold-out
rounds in the ledger still show the deltas. The guard's finding always
gets its own ledger line, which says what it found and, when nothing
was capped, why not.

The story leads with rivals and reads the named audience as the
benchmark: "your comparables agree" when the named row holds,
"a rival matches them too" when a rival matches the comparables.
If the top audience is not the named one and beats it by the
surprise margin (0.10), the headline becomes "Your best fit is not the audience you named."
Results within 0.06 of the control line read as a close call
(display only — the verdict never changes there).

### 6.8 Reach plan

Only when an audience clears control. Interests come from the
already-fetched taste tags (zero new calls); people, podcasts,
brands and places come from related fetches, minus titles the run
already used. Each winning audience renders as one vertical card:
Interests, People, Podcasts, Brands, plus Places only when measured.
Each heading carries a short prose paragraph, not a list or a rank
row. The AI writes the prose from a fact sheet of measured names,
ranks, Qloo's English descriptions and the precomputed gap labels;
it may rephrase but may not add an entity, number or claim. A
deterministic draft is built first and remains the fallback for any
section the model cannot ground. Rank order lives in the prose.
Gaps — what the winner loves that the pitch lacks — come from taste
display names. The city map is cut, and no location call runs.

### 6.10 Output pages

The flow result page carries the verdict band, ranked bars with
the fit index, the reach card (one vertical prose block per audience),
and the chatbot comparison, followed by the evidence drawer. The
header's sample result is a static showcase page rendering the same
components over fixtures — it uses fixture reach prose and makes no
Qloo or AI calls. (The old printable audience-case page was removed
with the v1 pipeline.)

### 6.11 Chatbot comparison

The same pitch is sent to the same AI with no Qloo tools: who is
this for and where do I find them. Titles in the answer are checked
in Qloo and marked found / not found. Either side may fail
independently and renders its honest empty state. The chatbot card
is framed as unmeasured: nothing there was checked except the title
marks.

### 6.12 Evidence trace

Every run records its Qloo calls — request, response summary,
status, and whether each came from cache — grouped in the evidence
drawer with per-step links. Checkability is per-run, not per-claim:
inline per-claim cites were removed from result rows (Oct 13) in
favor of the drawer. Saved runs replay from localStorage without
re-running. Raw Qloo payloads are never committed (private caching
only); docs record aggregates and conclusions.

## 7. Who does what

| Component | Responsibility |
|---|---|
| Qloo | Looking up titles and tags, audience tastes, related items, entity-seeded title suggestions, title tag labels. The source of every number, tag and title |
| The AI | Reads the pitch into words and type; picks which similar-labels fit the pitch (filters, never invents scoring tags); points leftover words at fetched tastes when bridges are on; writes chatbot prose; rewrites reach prose from the run's fact sheet |
| Our code | Gates, rival discovery assembly, scoring, the control ceiling, the verdict, grounding, and the deterministic reach draft |

The AI does not invent tags, titles, scores, audiences or reach
entities, and it does not rank anything. Reach prose may only rephrase
the supplied names, ranks, descriptions and gap labels; validation
rejects unknown names, new numbers, rank drift and speculative
relationships, and the section falls back to the deterministic draft.
Bridge weights are fixed in code. Title suggestions come from Qloo
entities you named, never from the model.

## 8. How the run behaves

One fixed pipeline, same order every run: scope gate → cheap
empty-check → titles resolve (≥1) → named tastes + rivals → controls
→ tag pool + pool gate → hold-out rounds → scores →
verdict → reach plan only if control is cleared → reach prose (AI,
bounded; deterministic draft fallback) → optional comparison on its
own route. It stops early and says the cause when: the pitch is out
of scope (tool/app, zero Qloo calls), nothing to judge, or the pooled
tags run too thin. One step inside it is conditional: rival discovery
re-asks the graph from the named titles when the pitch's own words
found nothing (§6.3), and the run says so when it does. The hold-out
rounds are read twice: once for the deltas the ledger shows, once for
the fragility test that can cap the verdict (§6.6, §6.7) — same
rounds, no extra call. After assembly the run checks every title, reach
name and scoring tag about to be displayed against the ids Qloo
returned in that run — resolved titles, rival, stranger and reach
entities, every taste list, plus the chip-step tag matches. Anything
ungrounded is stripped before scoring or display and named in the run
steps; the result records the check, so it can never ship an
ungrounded id (§8, §10 #1). One miss never fails a batch: failures degrade to
not-found / failed / no-data entries with their traces. A provider
rate limit or a call-budget breach is not a miss: the API answers 429
with a `quota` state (`rate-limited` | `exhausted`) instead of
reporting a title as not found or a preview as empty. The reach
prose call has a per-provider timeout and never blocks the result on a
failure: any section the model cannot ground ships as the draft. The
AI's only judgments are the words, the similar-label picking, the
chatbot prose and the reach prose rewriting (plus bridge pointing when
bridges are on) — everything else is code and deterministic.

## 9. Demo plan

Length: about 90 seconds.

1. State the problem in two sentences: the audience data is locked away from
   the people who need it (§2.1), and taste — not demographics — decides
   who watches (§2.3). Name one source per sentence; do not stack stats.
2. Paste a real pitch, or click the demo button (the cyberpunk Strong
   case), keep or fix the word chips, and confirm the comparable
   titles.
3. Show the live run, then the verdict. If a real pitch produced a surprise, lead with it. If none did, say so and show how the control test protects against false confidence.
4. Open the reach card: one vertical prose block per audience, written
   from the measured names, ranks, descriptions and gaps.
5. Show the chatbot comparison with the found / not-found marks.
6. End on the static sample for the no-network case.

Prepare three or four real pitches in advance. One should be an inconclusive case, shown deliberately as a trust moment.

The demo domain is film first, music second (day-one coverage test). Book and game are on hold: book entities return no taste tags, game taste vectors are too diffuse to discriminate.

## 10. Acceptance tests

| # | Test | Pass condition |
|---|---|---|
| 1 | Grounding | Across 20 runs, every title and tag in the final output came from that run's Qloo results; every bridge target was an already-fetched taste id |
| 2 | Nonsense pitch | Three deliberately meaningless pitches return Weak or Inconclusive |
| 3 | Circularity gate | Hold-out rounds rescore everyone on the same reduced set; the named row's self-fit delta renders beside it. If the named audience wins only on its own gifts (full-set win, hold-out collapse), stop and review before building more |
| 4 | No data | A pitch with unmatched words shows "no data" and never a low score standing in for it |
| 6 | Speed | A full run finishes in about 90 seconds |
| 7 | Repeatability | Same words re-run give the same verdict |
| 8 | Trace | Every run's evidence drawer opens its Qloo calls |
| 9 | Access | The live demo loads with no login and the repository is public |
| 10 | Bridge discrimination | Bridges widen the right gap (right audience rises, wrong ones stay) and never inflate every audience together |
| 11 | Pitch-aware ceiling | A control sharing ANY title with the named audience does not set the ceiling; the run says how many controls were excluded |
| 12 | Reach prose grounding | Every name in the reach prose came from that run's reach items, every gap label from that run's gaps, and every rejected model section fell back to the deterministic draft |
| 13 | Ceiling never vanishes | When every control shares a title with the named audience, the full control set still sets the ceiling (the step says the filter fell back) and the verdict is still judged against a real baseline |
| 14 | Fragility guard | A named audience that a hold-out round drops further than the field never reads Strong fit: when the verdict is about that named audience it is capped at Mixed fit and the reason (which title, what it did) is shown in the run ledger, the brief and the result card |

Test 3 is a decision gate, not a pass or fail on shipping. A tool that always agrees with the user's guess is not worth building.

## 11. Risks

| Risk | Why it matters | Mitigation |
|---|---|---|
| Qloo quota or rate limits | A live demo could fail (429s observed on monthly quota) | Static sample page; cached controls; saved runs |
| AI slowdowns or errors during the demo | Same | Groq/OpenRouter fallback; reach prose falls back per section to the grounded draft; bounded provider timeouts; bridges fail silent; static sample |
| Reach prose invents an entity or relationship | Fictional demo entities make world knowledge unreliable, and the product promises it does not make things up | Model writes only from the run's fact sheet; validation rejects unknown names, new numbers, rank drift and speculation; deterministic draft fallback |
| Verdicts swing on wording near the margins | Re-runs read inconsistently | The user locks the word set before the run; close-call flag |
| Book/game taste data is thin | Scores read 0.00 that may be missing data, not dislike | Both on hold; film first, music second |
| Location data is thin for the chosen city | The city map would mislead | Cut. No location call runs |
| Whether creators will pay is unverified | Judges ask who pays | Show the sample result to a few creators in the target group; run the §3.1 back-test and free-run offers until at least one real creator has reacted |
| The impact evidence is other people's research | Judges check sources; one misquoted figure costs the whole case | Every figure traced to a primary source in `docs/impact-evidence.md`; the caveats (US-only, vendor-run samples) travel with the number into the write-up |
| No creator has used the product | "Potential impact" needs a real audience, and none has confirmed one | §3.1. Until a real reaction exists, the claim stops at "the problem is documented" and says so |
| The name suggests gap finding | Judges may expect a market-gap tool | Explain the name in the pitch and make no unserved-market claims |
| Close neighbors on the hackathon list | Entries like CultureFit Guard, SponsorScout, CulturePilot and TasteCritic overlap in part | Lead with rivals and the control test |

## 12. Ship status

Shipped (flow path): idea entry with detected type, a one-click demo
pitch (Strong) that carries its comps, tag chips with live match
status and the matched-tag gate, named audience plus
Qloo-discovered rivals with the re-plan when the pitch's words find
nothing (§6.3), cached controls with pitch-aware ceiling,
rank scoring with AI bridges, verdict with guards, reach card with
grounded AI prose, chatbot comparison with Qloo marks,
evidence drawer, static sample page.

Cut: city map, printable audience case, second-domain support
(book/game on hold).

Removed from the codebase, not parked behind a flag: exclusion
("nothing like"), tag-expansion retry, concept audience, pinned
must-have words, and the city-map, concept-audience and
LLM-proposed-rival modules.

Deployed (2026-10-20): **https://whitespace-ecru.vercel.app/** — Vercel,
production build from `main`, no login. The Qloo and LLM keys live in
the Vercel project's env vars, so the live demo runs the same pipeline
as `pnpm dev`; without them it would fall back to the honest mock mode
(§11). The static sample stays as the no-network fallback (§9).

## 13. Competition

These descriptions come from the vendors' own materials and have not been independently checked.

| Tool | What it does | How Whitespace differs |
|---|---|---|
| Cinelytic | Analytics for film financing and greenlight decisions, used by studios | Whitespace compares rival audiences using cross-domain taste data and aims at work with no track record |
| Greenlight Essentials | Screenplay analysis that identifies core audiences for indie filmmakers | Whitespace tests the user's guess against rivals and a control, and gives a reach plan |
| Chartmetric, Viberate, Soundcharts | Artist audience data by city | These start from an artist. Whitespace starts from an idea |
| Publisher Rocket | Amazon keyword and category research for authors | Amazon data only. No cross-domain taste |
| Parrot Analytics | Audience-demand measurement for film and TV, sold to studios and distributors; a contributor to the Shorenstein study (§2.1) | Parrot measures demand for **released** work. Whitespace scores a work that does not exist yet, against its rivals, and says who it fits |
| BFI audience tracker | Public audience data for UK indie releases, funded as a public good (§2.1) | A sector-wide tracker for released films. Whitespace is per-pitch, per-creator, and cross-domain |
| A plain chatbot | Answers "who is this for and where do I find them" from model weights | No measured data, no control, no trace. The app shows both answers side by side (§6.11) |

What sets Whitespace apart is the rival audiences, the control test, honest "no data" handling, and recorded Qloo calls behind every run.

The gap the incumbents leave is not features, it is *timing and cost*: the
research in §2.1 says independent creators are the group the audience data
is locked away from, and every tool above either works on released work or
sits behind an enterprise price. The input Whitespace asks for — comparable
titles — is the artifact a creator already produces for a pitch deck (§2.3).

## 14. Open decisions

1. Re-running the 6-pitch table to confirm bridges discriminate (widens gaps) rather than inflate.
2. Whether the city map ever ships (currently cut; no location call runs).
3. Whether any of the removed options (exclusion, expansion, concept or pinning) are ever rebuilt onto the flow path.
4. Final re-calibration of verdict margins once bridges are in the live mix.
5. ~~Whether any other sponsor technology or extra judging criteria on the Devpost page carry points. Check the page again before building.~~ Checked 2026-10-19: the four judging criteria are technological implementation, design, potential impact, and quality of the idea. No extra sponsor technology is required.
6. ~~Repository license.~~ Decided 2026-10-19: MIT (`LICENSE` at the repo
   root, so GitHub shows it in the repo About section).
7. The deadline's time zone. Confirmed 2026-10-19: 2026-10-30, 11:45pm EDT.
8. ~~Required Devpost fields complete, per the current rules on the page.~~ The page requires: a live functional demo URL, a public repo, a text description, external hosting, and an open-source licence visible in the repo About section. The description text is drafted in `docs/devpost-description.md`; the rest are §15.
9. ~~Where the demo is hosted.~~ Resolved 2026-10-20: deployed on Vercel at **https://whitespace-ecru.vercel.app/** — no login, no sign-up. Verified from outside the app: `/`, `/flow` and `/demo/result` all return 200, and `POST /api/tags` + `POST /api/titles/check` return live Qloo data (real tag ids, resolved entity ids), so `QLOO_API_KEY` and the LLM keys are set in the Vercel project's env vars. No deploy config file is needed: Vercel's Next.js preset builds the repo as-is, and the keys stay in Vercel settings, never in the repo. The `DEMO_URL` and `REPO_URL` placeholders in `docs/devpost-description.md` are filled.

## 15. Submission checklist

1. The live demo loads with no login. — **done 2026-10-20**: <https://whitespace-ecru.vercel.app/> (landing, `/flow` and `/demo/result` all 200 from outside; `POST /api/tags` returns real Qloo tag ids and `POST /api/titles/check` resolves `Moonlight` and `Aftersun` to live entity ids, so the Vercel env vars are set).
2. Public repository with a README covering setup, the Qloo calls used and the grounding check.
3. Description text that matches the brief, with no claims about outcomes or users — `docs/devpost-description.md`.
4. Static sample result included (`/demo/result`, no Qloo calls) — live at <https://whitespace-ecru.vercel.app/demo/result>.
5. Required Devpost fields complete, per the current rules on the page.
6. README carries the same sourced problem statement as §2, with a Sources section pointing at `docs/impact-evidence.md`.
7. Every figure quoted in the description and the README matches `docs/impact-evidence.md` exactly, caveats included.

## Appendix A. Illustrative example (invented, not Qloo output)

Pitch: a quiet science-fiction film about a lonely worker on a space station.

The user's guess is fans of other slow science-fiction films. Whitespace discovers rival readings from Qloo data: readers of literary fiction about isolation, listeners of ambient music. It also draws control audiences from unrelated material.

If the pitch tags (for example "slow-burn" and "solitude") score highest against the literary-fiction rival and clear the control by a clear margin, the headline says the best fit is not the audience the user named. The reach plan then lists podcasts, people, brands and places that audience loves.

If no audience clears control, the verdict is Weak fit and the app recommends checking with real people before the user spends more.

## Appendix B. Glossary

Named audience: the audience built from the user's own confirmed "similar to" titles. Absent when no titles are given.
Rival audience: an audience built from Qloo-discovered entities related to the pitch, not from model prose.
Control audience: an audience built from fixed other-genre seeds, shown as context bars. The best eligible, judgeable control sets the ceiling only when strangers are unmeasured.
Strangers baseline: one far crowd per pitch, taken from the bottom-unused entities of the live discovery ranking and scored identically; sets the verdict line when judgeable.
Pitch tags: real Qloo tags that match words from the pitch.
Coverage: the share of suggested words that matched a real Qloo tag.
Bridge: an AI-pointed link from a leftover pitch word to an already-fetched taste id, with a fixed-weight bucket (strong 0.75, related 0.5, distant 0). Never points at a tag already in the scored pool; a weighted bridge no contender holds is dropped.
Margin: the fit-score difference between two audiences.
Close call: a result within 0.06 of the control line; the verdict stands but the UI says a re-run may read differently.
No data: Qloo did not return enough to judge. Not the same as "doesn't care".
Inconclusive: the app cannot say anything reliable and says why (scope, tags, coverage, no-data, empty, no-control, no-signal, top-unjudgeable).
