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

You make something for months. Friends say it's great. It launches, and the people who show up are the ones who already liked your last thing. You picked an audience, then checked it only against people who already liked you. Nobody compared it with the other audiences it could have fit, and nobody told you where to find them.

This is a scenario, not a finding. Nothing in this section is backed by a statistic yet. If the team finds a source, add it here. Until then the wording stays soft.

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

## 5. User journey

1. The user types an idea into the plain entry box on the home page. Submit hands the pitch to a blank run page through an animated page move; the pitch box morphs into the dotted orb there and each leg plays its morph→think→resolve cycle, never on the landing page. Legs end quietly — no receipt cards: mid-run legs hold the orb with a "waiting for your input" nudge while the leg UI below takes over, and the scored run ends on the green flash before the result lands. The work type is detected, never picked.
2. The app shows descriptive word chips (matched / not found in Qloo) under the circle, then asks for similar titles, shows entity-seeded suggestions on check, and finally the aggregated tag set for review. The user edits the words, taps titles to name their crowd, and confirms each step with Done / Continue.
3. The user watches the circle report each step in one honest line beneath it while the run scores.
4. The user sees the verdict, the ranked audiences with margins, and any "no data" flags.
5. The user opens the reach plan for a winning audience.
6. Optionally, the user adds a limit and sees an accepted change with a before-and-after score, or a withheld change naming the failed condition.
7. The user compares the result with a plain chatbot's answer, whose titles are marked found / not found in Qloo.
8. A static sample result is always available from the header with no login.

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
There is no "nothing like" input on the flow path: exclusion is
unwired.

### 6.2 Named audience

The user-confirmed similar titles (at least 1) are resolved
live in Qloo (pre-checked on demand before the run, re-resolved
at run time). Resolved titles form the named audience; misses are
reported as not found, never scored. Each resolved title (up to 5)
gets its own taste fetch: those taste labels are the tag pool's
base, and each title gets a hold-out round (§6.6). Titles past 5
still join the hypothesis signal but get no hold-out round.

### 6.3 Rival audiences

Rivals are discovered from Qloo data alone, never proposed by a
model: seeded from the named audience's entities when they exist,
else from the pitch's matched tags. Each rival is a real Qloo
entity's fan base, named after that entity, so the name is a fact.
Discovery fills contenders to four (fewer when Qloo returns fewer).
Zero contenders — no titles and no discovered rivals — stops the run
as Inconclusive before any control or taste call is spent.

### 6.4 Comparison field (controls)

About 20 fixed same-domain audiences (genre-spread seeds for film
and music; 6 fallbacks each for book and game) are resolved once and
their tag sets cached for 30 minutes; every pitch is scored fresh
against the cached sets. Seeds that resolve to nothing are dropped
and reported, never kept.

Those controls are the field the verdict measures against (§6.7),
not merely context. Controls sharing more than a third of their
titles with the named audience are excluded as too close; when every
control is too close, the full set comes back so the field never
vanishes. The strangers baseline — the bottom-unused entities of the
same live discovery ranking rivals come from (weakest overlap with
the pitch, own domain first), one extra taste fetch — joins the same
field whenever it is judgeable. The ink line on the chart is the
strongest judgeable member of that field, so the line can never sit
above a bar the verdict did not have to clear.

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
failed) instead of one vague line. The result always shows coverage,
but coverage is a display fact, not a gate: scoring runs on the
pooled set, so sufficiency is the pooled count. A cheap empty-check
stops title-less, word-less runs for ~0 calls; the real gate runs
once on the combined pool — fewer than 3 pooled tags stops the run
as Inconclusive before scoring. A pitch whose words match Qloo poorly
is still judged when its titles carry the pool (2026-10-19).

### 6.6 Scoring

Qloo describes each audience as a taste list ranked by strength. The
app keeps the order and discards the raw strengths (ranks only,
never counts): rank r of N scores (N − r + 1) / N. Each audience's
fit is the weighted mean across one shared tag list, 0 to 1. There
is no pinning on the flow path: every exact tag weighs 1.

The circular fix: the pool comes from the titles the user named, so a
named-audience win is circular until it survives without those gifts.
Hold-out rounds rescore every audience — named, rivals, controls,
strangers — on the same reduced set, one round per gifting title, and
the deltas render beside the named row. The self-fit gate (§6.7) goes
one step further for the verdict itself: the whole field is rescored
on the pitch-grounded tags alone (pool tags the description supplied
by id, plus bridges), and only a lead that survives that rescore can
be Strong.

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
could only grow every denominator and no numerator (2026-10-19). The
weights are fixed in code: the AI points, our code scores. Same words
always give same scores.

### 6.7 Control test and verdict

An audience "clears control" when it beats EVERY judgeable comparison
audience in the measured field (§6.4): the eligible other-genre
controls plus the strangers baseline when measured. There is no fixed
gap: fit scores are a weighted mean over K pooled tags, so the same
relationship reads 0.180 at K=12 and 0.036 at K=60 — a set-point
margin flipped Strong/Weak on pool size alone, so it is gone
(2026-10-19). The field must be real before it can gate anything:
at least 8 judgeable controls (placeholder zeros never count), and
the strongest comparison must hold at least 2% of the pooled tags
(never fewer than one). A tie with a comparison is not a win.

| Verdict | Meaning |
|---|---|
| Strong fit | The top audience clears the field AND is clearly ahead of the measured runner-up (lead ≥ 5% of its own score) AND the self-fit check confirms the lead |
| Mixed fit | The top clears the field, but either the runner-up is within that 5% (a photo-finish) or the lead stops holding once the tags from the named titles are removed (self-fit "leans") |
| Weak fit | A measured comparison audience beats the top |
| Inconclusive | The pooled set is too thin, too many audiences had no data, the field itself was unmeasured, or the lead could not be checked without its own title gifts |

Guards, all Inconclusive, never Weak: fewer than 3 pooled tags (the
pitch-word coverage rate is reported, never a gate); more than half
the scores unjudgeable; an unjudgeable top; no contenders; fewer than
8 judgeable controls; a strongest comparison holding too little of
the pool (or exactly nothing); the self-fit check leaving too few
pitch-grounded tags to judge; no titles; out-of-scope pitch.

The story leads with rivals and reads the named audience as the
benchmark: "your comparables agree" when the named row holds,
"a rival matches them too" when a rival matches the comparables.
If the top audience is not the named one and beats it by 10% of the
top's own score, the headline becomes "Your best fit is not the
audience you named." Results within 0.06 of the line read as a close
call (display only — the verdict never changes there). The result
states how many measured comparison audiences the winner beat
("beats 19 of 20 other-genre audiences") and, when the self-fit check
ran, whether the lead survived its own titles.

### 6.8 Reach plan

Only when an audience clears control. Interests come from the
already-fetched taste tags (zero new calls); people, podcasts,
brands and places come from related fetches, minus titles the run
already used. Winners render as a 3-step playbook (listen first,
find them, fit in). Gaps — what the winner loves that the pitch
lacks — come from taste display names. The city map is cut: the
map UI stays unwired and location calls fail closed.

### 6.9 Change and re-check

The user can add a limit, such as a smaller budget. The proposal is
built deterministically from the gap words (no LLM) and rescored
identically. The bar is recorded before the proposal runs and is at
least the tie margin: a change is accepted only if the fit rises by
at least the bar (the absolute floor, or the recorded share of where
the fit already stood), the winner's lead over the comparison field
does not shrink, coverage holds, every new tag is grounded, and the
audience still clears control by the run's own rule (§6.7). A rewrite
that lifts everyone rather than the winner is withheld as
"separation". Otherwise the app withholds the change and names the
failed condition. A withheld change is a normal outcome.

### 6.10 Output pages

The flow result page carries the verdict band, ranked bars with
scores, the reach playbook, the gaps-plus-change card, and the
chatbot comparison, followed by the evidence drawer. The header's
sample result is a static showcase page rendering the same
components over fixtures — it makes no Qloo calls. (The old
printable audience-case page was removed with the v1 pipeline.)

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
| The AI | Reads the pitch into words and type; picks which similar-labels fit the pitch (filters, never invents scoring tags); points leftover words at fetched tastes when bridges are on; writes chatbot prose |
| Our code | Gates, rival discovery assembly, scoring, the control ceiling, the verdict, the change check, and grounding |

The AI does not invent tags, titles, scores or audiences, and it does not rank anything. Bridge weights are fixed in code. Title suggestions come from Qloo entities you named, never from the model.

## 8. How the run behaves

One fixed pipeline, same order every run: scope gate → cheap
empty-check → titles resolve (≥1) → named tastes + rivals →
controls → tag pool + pool gate → hold-out rounds → scores →
verdict → reach plan only if control is cleared → optional change
and comparison on their own routes. It stops early and says the
cause when: the pitch is out of scope (tool/app, zero Qloo calls),
nothing to judge, or the pooled tags run too thin. One miss never
fails a batch: failures degrade to not-found / failed / no-data
entries with their traces. The AI's only judgments are the words,
the similar-label picking, and the chatbot prose (plus bridge
pointing when bridges are on) — everything else is
code and deterministic.

## 9. Demo plan

Length: about 90 seconds.

1. State the problem in two sentences.
2. Paste a real pitch, keep or fix the word chips, tap a suggested title.
3. Show the live run, then the verdict. If a real pitch produced a surprise, lead with it. If none did, say so and show how the control test protects against false confidence.
4. Open the reach playbook.
5. Show one change that was accepted or withheld.
6. Show the chatbot comparison with the found / not-found marks.
7. End on the static sample for the no-network case.

Prepare three or four real pitches in advance. One should be an inconclusive or withheld-change case, shown deliberately as a trust moment.

The demo domain is film first, music second (day-one coverage test). Book and game are on hold: book entities return no taste tags, game taste vectors are too diffuse to discriminate.

## 10. Acceptance tests

| # | Test | Pass condition |
|---|---|---|
| 1 | Grounding | Across 20 runs, every title and tag in the final output came from that run's Qloo results; every bridge target was an already-fetched taste id |
| 2 | Nonsense pitch | Three deliberately meaningless pitches return Weak or Inconclusive |
| 3 | Circularity gate | The named winner is rescored on the pitch-grounded tags alone (shared reduced set: every audience on the same list). If its full-set win collapses without its own title gifts, the verdict is Mixed "leans" or Inconclusive "self-fit" — never Strong |
| 4 | No data | A pitch with unmatched words shows "no data" and never a low score standing in for it |
| 5 | Change refusal | A change that fails the bar is withheld and the page names the failed condition |
| 6 | Speed | A full run finishes in about 90 seconds |
| 7 | Repeatability | Same words re-run give the same verdict |
| 8 | Trace | Every run's evidence drawer opens its Qloo calls |
| 9 | Access | The live demo loads with no login and the repository is public |
| 10 | Bridge discrimination | Bridges widen the right gap (right audience rises, wrong ones stay) and never inflate every audience together |
| 11 | Pitch-aware ceiling | A control sharing more than a third of titles with the named audience does not set the ceiling |

Test 3 is a decision gate, not a pass or fail on shipping. A tool that always agrees with the user's guess is not worth building.

## 11. Risks

| Risk | Why it matters | Mitigation |
|---|---|---|
| Qloo quota or rate limits | A live demo could fail (429s observed on monthly quota) | Static sample page; cached controls; saved runs |
| AI slowdowns or errors during the demo | Same | Groq/OpenRouter fallback; bridges fail silent; static sample |
| Verdicts swing on wording near the margins | Re-runs read inconsistently | The user locks the word set before the run; close-call flag |
| Book/game taste data is thin | Scores read 0.00 that may be missing data, not dislike | Both on hold; film first, music second |
| Location data is thin for the chosen city | The city map would mislead | Cut. Fails closed with a reason |
| Whether creators will pay is unverified | Judges ask who pays | Show the sample result to a few creators in the target group |
| The name suggests gap finding | Judges may expect a market-gap tool | Explain the name in the pitch and make no unserved-market claims |
| Close neighbors on the hackathon list | Entries like CultureFit Guard, SponsorScout, CulturePilot and TasteCritic overlap in part | Lead with rivals, the control test and the withheld change |

## 12. Ship status

Shipped (flow path): idea entry with detected type, tag chips with
live match status and the pooled-tag gate, named audience plus
Qloo-discovered rivals, cached controls scored as a comparison field,
rank scoring with AI bridges, rank-based verdict with field and
self-fit guards, reach playbook, change re-check with a separation
bar, chatbot comparison with Qloo marks, evidence drawer, static
sample page.

Cut: city map, printable audience case, second-domain support
(book/game on hold).

Deliberately unwired on the flow path: exclusion ("nothing like"),
tag-expansion retry, concept audience, pinned must-have words.
Each is a live option with a known shape (see `docs/qloo-coverage.md`)
if a future test earns it back.

## 13. Competition

These descriptions come from the vendors' own materials and have not been independently checked.

| Tool | What it does | How Whitespace differs |
|---|---|---|
| Cinelytic | Analytics for film financing and greenlight decisions, used by studios | Whitespace compares rival audiences using cross-domain taste data and aims at work with no track record |
| Greenlight Essentials | Screenplay analysis that identifies core audiences for indie filmmakers | Whitespace tests the user's guess against rivals and a control, and gives a reach plan |
| Chartmetric, Viberate, Soundcharts | Artist audience data by city | These start from an artist. Whitespace starts from an idea |
| Publisher Rocket | Amazon keyword and category research for authors | Amazon data only. No cross-domain taste |

What sets Whitespace apart is the rival audiences, the control test, honest "no data" handling, a change it will withhold, and recorded Qloo calls behind every run.

## 14. Open decisions

1. Re-running the 6-pitch table to confirm bridges discriminate (widens gaps) rather than inflate.
2. Whether the city map ever ships (currently cut, fails closed).
3. Whether exclusion, expansion, concept or pinning earn their way back onto the flow path.
4. Final re-calibration of the share bars (tie 5%, surprise 10%, rise
   10%, ceiling support 2%) against live runs, plus the bridge
   discrimination re-check on the 6-pitch table.
5. Whether any other sponsor technology or extra judging criteria on the Devpost page carry points. Check the page again before building.
6. Repository license.
7. The deadline's time zone.
8. Required Devpost fields complete, per the current rules on the page.

## 15. Submission checklist

1. The live demo loads with no login.
2. Public repository with a README covering setup, the Qloo calls used and the grounding check.
3. Description text that matches the brief, with no claims about outcomes or users.
4. Static sample result included (`/demo/result`, no Qloo calls).
5. Required Devpost fields complete, per the current rules on the page.

## Appendix A. Illustrative example (invented, not Qloo output)

Pitch: a quiet science-fiction film about a lonely worker on a space station.

The user's guess is fans of other slow science-fiction films. Whitespace discovers rival readings from Qloo data: readers of literary fiction about isolation, listeners of ambient music. It also draws control audiences from unrelated material.

If the pitch tags (for example "slow-burn" and "solitude") score highest against the literary-fiction rival and clear the control by a clear margin, the headline says the best fit is not the audience the user named. The reach plan then lists podcasts, people, brands and places that audience loves.

If no audience clears control, the verdict is Weak fit and the app recommends checking with real people before the user spends more.

## Appendix B. Glossary

Named audience: the audience built from the user's own confirmed "similar to" titles. Absent when no titles are given.
Rival audience: an audience built from Qloo-discovered entities related to the pitch, not from model prose.
Control audience: an audience built from fixed other-genre seeds. The judgeable, title-eligible controls plus the strangers baseline form the comparison field the verdict must beat (§6.4).
Strangers baseline: one far crowd per pitch, taken from the bottom-unused entities of the live discovery ranking and scored identically; joins the comparison field when judgeable.
Self-fit: the winning audience rescored with the tags from the named titles removed. A lead that survives is confirmed; one that collapses is "leans"; one too thin to judge is "unverified" (§6.7).
Pitch tags: real Qloo tags that match words from the pitch.
Coverage: the share of suggested words that matched a real Qloo tag.
Bridge: an AI-pointed link from a leftover pitch word to an already-fetched taste id, with a fixed-weight bucket (strong 0.75, related 0.5, distant 0).
Margin: the fit-score difference between two audiences.
Close call: a result within 0.06 of the control line; the verdict stands but the UI says a re-run may read differently.
No data: Qloo did not return enough to judge. Not the same as "doesn't care".
Inconclusive: the app cannot say anything reliable and says why (scope, tags, coverage, no-data, empty, no-control, no-signal, top-unjudgeable).
