# Devpost submission text

Status: draft, 2026-10-19. Deadline **2026-10-30, 11:45pm EDT**
(confirmed from the hackathon page). Judging criteria, confirmed the same
day: **technological implementation**, **design**, **potential impact**,
**quality of the idea**.

Every figure below is traced in [`impact-evidence.md`](impact-evidence.md).
Before pasting, re-check that file — a misquoted number is the one thing
that can sink the whole submission.

Placeholders to fill: `DEMO_URL`, `REPO_URL`.

---

## Inspiration

The audience for a piece of work is knowable. Almost nobody can look it up.

The Harvard Kennedy School's Shorenstein Center surveyed 14,421 US adults and
combined the result with Nielsen, Parrot Analytics and The Numbers. Their
finding is the reason this project exists:

> "Data is not publicly available to small independent film businesses or
> independent creators, which puts this sector at a disadvantage compared to
> the large, tech enabled businesses dominating the US media."

The BFI found the same wall in the UK, where research on individual titles was
"prohibitively expensive for independent distributors". Two institutions,
two continents, one locked door.

The cost is not abstract. An estimated 76.3M Americans are in the addressable
audience for independent film; an estimated 36.7M watched one in 2022–23.
Per-title viewing is low "due to the lack of marketing to bring attention to
small titles".

Independent musicians say the same thing from the other side of the
industry. Across three separate studies of 6,800+ artists: **74%** of 5,039
independent artists earned under $1,000 from music in the past year; **54%**
of 300 independent musicians name "getting music heard" as their biggest
challenge; and discoverability is the single biggest barrier for **35.8%** of
1,595 independent rappers.

Meanwhile the supply of work keeps growing — Nollywood alone produces
roughly 2,500 films a year — and the one audience artifact every creator
already makes gets no audience attached to it.

## What it does

**Whitespace tells a creator which audience their idea actually fits, how
strongly, and where to find those people — before the work exists.**

You paste a pitch (a film, an album, a book, a game). The app reads the
descriptive words and the work type out of it, you confirm the words, and you
name the comparable titles the industry already asks you for. Then it runs:

1. **Your audience** — the fans of the titles you named, built from Qloo's
   taste graph.
2. **Rival audiences** — discovered from Qloo's related-entity graph, never
   proposed by a model. These are the audiences your work could have reached
   instead of the one you named.
3. **Control audiences** — ~20 fixed other-genre audiences in the same domain,
   cached and scored identically. They are the bar your idea has to clear.
4. **The verdict** — Strong / Mixed / Weak / Inconclusive, with the ranked
   audiences and the margin over the control line.
5. **The reach plan** — for any audience that clears the bar: the interests,
   people, podcasts, brands and places that audience actually loves, written
   from the measured names and ranks.
6. **The chatbot comparison** — the same pitch to the same AI with no Qloo
   tools. Its titles are marked *found* / *not found* in Qloo, so you can see
   the difference the data makes.
7. **The evidence drawer** — every Qloo call of the run: request, response
   summary, status, cache hit.

The headline case is the one the product is built for: **"Your best fit is not
the audience you named."** A filmmaker who thinks their film is for the fans
of *Moonlight* and *Aftersun* may find out, measured, that the people who
over-index on its actual themes are somewhere else entirely — and that the
audience they named scores no better than unrelated strangers.

### Why comps are the right input

Comparables are not our invention; they are the industry's ritual. Sundance's
pitch deck guidelines require comparable films, and say why:

> "Unlike a financial comp which suggests the financial goals for your film, a
> creative comp shows audience interest for your film (no figures)."

A creative comp *is* a claim about an audience. It is also the one part of
audience research that is free, instant, and already in the creator's head.
Whitespace takes that artifact and does the part no human can do by hand:
compare the audience behind your comps against the audiences the same work
could have reached instead, and check whether your guess clears a bar set by
people who have nothing to do with your film.

## How we built it

Next.js 16 (App Router, server components), TypeScript, Tailwind, Biome.
The Qloo boundary is a single module; everything else is deterministic code.

**Qloo calls** (all `GET`):

| Endpoint | Used for |
|---|---|
| `/search` | Resolve a similar title to a Qloo entity; verify each title on demand |
| `/v2/tags` | Match pitch words to real Qloo tags, scoped per work type, with a semantic-search second pass for words the plain pass misses |
| `/v2/insights` (`filter.type=urn:tag`) | Audience taste lists — the substance of every score |
| `/v2/insights` (entity types) | Rival-audience discovery, entity-seeded title suggestions, and the reach items (people, podcasts, brands, places) |
| `/v2/tags` (title labels) | Taste labels attached to the titles you named |

**What only works because of Qloo.** The heart of the product is a
*measurement*, and measurement is not something a language model can
fabricate: whether Aftersun's audience over-indexes on grief more than
Moonlight's does, relative to twenty unrelated audiences, is a fact about
250M+ entities' taste graph and has no approximation in model weights. The
same goes for the tag namespace (real tag ids to match a creator's words
against), entity resolution (mapping "Moonlight (2016)" to the right entity
id), and the reach graph (people and podcasts that actually belong to an
audience, minus the ones the run already used).

**The AI's job is small and bounded.** It reads the pitch into words and type,
filters which title labels fit, points leftover words at already-fetched
tastes, writes the chatbot answer, and rephrases the reach prose. It never
invents a tag, a title, a score, an audience, an entity or a ranking. Scoring
is code: rank `r` of `N` scores `(N − r + 1) / N`, raw strengths discarded,
every audience scored as a weighted mean over one shared tag list.

**Three properties we built on purpose.**

- *No data is never a low score.* A tag missing from a long enough taste list
  (10+) is a zero — that audience does not over-index on it. A tag missing
  from a short or failed list is *no data* and leaves the score entirely, so
  a thin API response can never fake a bad fit.
- *A control sets the bar.* "Strong" and "Mixed" require clearing the
  strangers baseline — or, when that is unmeasured, a pitch-aware
  other-genre ceiling — by a fixed margin. A tool that always agrees with
  the user's guess is not worth building, so the guard is the point.
- *Hold-out rounds break circularity.* Every audience is rescored on a
  reduced tag set with each gifting title removed, so an audience that only
  wins on the titles it donated shows its own collapse next to the named row.
- *Everything is checkable.* After assembly, a grounding check compares every
  title, entity id and scoring tag about to be displayed against the ids Qloo
  returned in that run. Anything ungrounded is stripped and named in the run
  steps. It is enforced at runtime, not asserted in a comment.

## Challenges we ran into

- **Taste queries need `filter.type=urn:tag`.** Without it the API silently
  ignores the entity signal and returns empty lists — a 200 that means
  nothing. Every taste fetch failed before that parameter was found.
- **Tags and tastes must be scoped to the same namespaces.** Unscoped taste
  lists return cross-domain noise (credit-card and restaurant tags for a
  movie audience), and unscoped tag search matches unrelated names
  (`slow-burn` → `specialty_dish:place`). Both now scope per work type.
- **The verdict is a trap if you let the user's guess win by default.** The
  first working version made the named audience the favourite whenever scores
  were close. The control test, the surprise margin and the hold-out rounds
  exist because a tool that agrees with you is worthless.
- **Free-tier AI and a monthly Qloo quota are both real constraints.** Every
  LLM call has a bounded timeout with a provider fallback; the reach prose
  falls back per section to a deterministic draft built from the same facts;
  a rate limit returns a `quota` state rather than a title misreported as
  "not found".

## Accomplishments we're proud of

- **The grounding check.** Every number on screen came from a Qloo call in
  that run, enforced by code at runtime, with the whole call log in an
  evidence drawer a judge can open.
- **The chatty control.** The verdict has a floor — ~20 unrelated audiences
  in the same domain — so "strong fit" means "strong *relative to strangers*",
  not "we liked it".
- **Honest Inconclusive.** Coverage guards, no-data guards and thin tag
  pools all produce *Inconclusive* with a stated cause, never a Weak fit
  dressed up as a finding. A trust moment that a demo can point at.
- **A static sample result** (`/demo/result`) that makes no Qloo or AI calls,
  so the demo never dies on a network.

## What we learned

**Comps are a claim about an audience that nobody had measured.** The input
was already there, free, and standard practice — the audience behind it was
the missing half.

**Taste is a better axis than demographics.** A peer-reviewed study of 3,204
viewers rating 209 films (Wallisch & Whritner, *Projections*, 2017) found
"the industry's targeting of film goers by broad demographic categories
seems off the mark", with age and gender explaining little agreement between
viewers, and prescribed slicing audiences into taste clusters. That is what
this tool compares.

**Being wrong about your audience is not a metaphor.** Across three separate
studies of 6,800+ artists: 54% of 300 independent musicians name "getting
music heard" as their biggest challenge; discoverability is the single
biggest barrier for 35.8% of 1,595 independent rappers; and 74% of 5,039
independent artists earned under $1,000 from music last year.

**The data gap is the opportunity.** The Harvard study is explicit that the
data is not public for small independents. Every incumbent tool either works
on released work (Parrot Analytics), works per-sector and per-title after
release (BFI's tracker), or starts from an existing artist (Chartmetric,
Viberate, Soundcharts). The unserved moment is *before* the work exists, for
a person who has no analyst.

**Honesty is a feature, and it costs.** Every "we don't know" in this
product — no data, inconclusive, close call, the data is missing — is a
deliberate output. A judge can open the evidence drawer and see that the
thing they are judging is not a hallucination with a progress bar.

## What's next

- **Back-test released work.** The real test: take films and albums that
  found an audience, pitch each as if unreleased, and check whether the
  audience Whitespace names is the audience that actually showed up. Publish
  the misses alongside the hits — a back-test that only shows wins is a
  marketing asset, not evidence.
- **Take it to creators.** Every run is free to try and every run comes with
  its evidence drawer, so the next step is simply more of them in front of
  more people.
- **Reach beyond film.** Film and music are covered today; book and game are
  detected and runnable but their taste data is too thin in the current Qloo
  dataset to discriminate, so they are on hold rather than faked.

## Built with

nextjs, typescript, tailwindcss, react, node.js, qloo-api

## Links

- Live demo: `DEMO_URL`
- Repository: `REPO_URL`
- Static sample (no network needed): `DEMO_URL/demo/result`

## Sources

Traced in full, with sample sizes and caveats, in
[`docs/impact-evidence.md`](https://github.com/DammyCodes-all/whitespace/blob/main/docs/impact-evidence.md).

- Shorenstein Center, Harvard Kennedy School — *US Independent Film Audience
  and Landscape Study* (Nov 2024) — <https://www.indiefilmlandscape.org/key-findings>
- British Film Institute — *Film release audience tracker* (Nov 2023) —
  <https://www.bfi.org.uk/get-funding-support/bring-film-wider-audience/audience-data-learnings/film-release-audience-tracker>
- Wallisch & Whritner (2017), *Projections* —
  <https://www.nyu.edu/about/news-publications/news/2017/may/our-taste-in-movies-is-highly-idiosyncraticand-at-odds-with-critics.html>
- Sundance Institute — *2024 Pitch Deck Guidelines* —
  <https://sundance.sundancedigitalxe.org/channels/uma/images/Feature-Film-Pitch-Deck-Guidelines.pdf>
- Ditto Music — *The Independent Music Report 2026* (n=5,039) —
  <https://dittomusic.com/en/independent-music-report-2026>
- Musosoup + Right Chord Music — *The Musician's Census 2024* (n=300) —
  <https://musosoup.com/blog/the-musicians-census-2024>
- Rap Fame — *The Rap Report 2026* (n=1,595) — <https://rapfame.app/report/2026>
- UNESCO — *African film: A booming industry* —
  <https://www.unesco.org/en/articles/african-film-booming-industry-1>
