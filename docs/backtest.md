# Back-test: Get Out (2017)

Status: ready to run, 2026-10-20. One film, two runs. This is the check
that turns "here is a mechanism" into "here is a mechanism that was right".

Spec ref: §3.1 (validate without a creator panel), §10 #3 (circularity gate),
§6.7 (verdict + surprise margin), §6.8 (reach plan).

---

## Why this film

Get Out is the rare case where the audience is **documented in numbers**, was
**analysed by the studio at the time**, and **did not match the genre** the
film was sold in. That gives us a ground truth to score against — and it is
a ground truth the tool could plausibly get wrong, which is the point.

**The documented truth.** Universal's marketing chief Peter Goldstine, in
Variety (2017-03-22):

> "Universal's marketing campaign for 'Get Out' pressed all the usual
> buttons for a low-budget R-rated horror film, with creative that emphasizes
> scares and media buying focused on genre devotees. **But that base alone
> didn't carry the movie** to its No. 1 ranking with $33.4 million in domestic
> box office for its opening weekend."

The studio reached outside genre deliberately — the trailer was paired with
serious films including *Fences*, and critically-lauded spots ran in *24:
Legacy* and *The Bachelor*. Goldstine: "It created a conversation."

The numbers agree:

| Fact | Figure | Source |
|---|---|---|
| Opening weekend | $33.4M | Wikipedia / Box Office Mojo |
| Audience split | 39% Black, 36% White, 17% Latino | AP, studio data |
| Over 25 in the crowd | 51% | Rotten Tomatoes (studio data) |
| Male / female | even split | same |
| Second-weekend drop | **15%** (horror's usual floor is 60%+) | Wikipedia |
| Budget | $4.5M → $255.5M worldwide | Wikipedia |

The Guardian's summary of the creative lineage: **"This is 12 Years a
Slave: The Horror Movie."** Peele himself cited *Guess Who's Coming to
Dinner* and *The Stepford Wives*; the Guardian added *Rosemary's Baby*.

**So the documented audience was:** not the horror crowd. It transcended
genre, skewed older and racially mixed, and the growth came from the
serious/conversation side. The industry reflex — "it's a horror film, so
horror people" — was wrong about the growth audience, and the studio's own
marketing chief said so.

## The ground truth, in the tool's terms

**Careful — this is the one place the test can go wrong.** The ground truth
above is *demographic* (39% Black, 51% over 25). Whitespace names *taste*
crowds, not demographics, and never will (§4.2). So we do not score the run
against "39% Black". We score it at the taste level:

> Did the run surface a crowd on the serious / conversation / social-engagement
> side — the crowd that watches *Fences* and *12 Years a Slave* — rather than
> only the horror crowd?

That is checkable in the reach plan (§6.8): the Interests and the named
entities are where a taste crowd shows its face.

**One more piece of luck.** Qloo's own taste profile for the Get Out entity
is already a blend, and it reads like the documented crossover:

> Literary Fiction · Science Fiction · Experimental cinema · Counterculture ·
> Political protest · Identity crisis · Intellectually curious · Marginalized
> people · gay character · Demon · Shower

Social drama and horror in the same list. That is Qloo's graph independently
describing a genre-transcending crowd — supporting evidence for the product's
premise, and a reason to expect the tool can land this.

---

## The pitch (paste this, unchanged, into both runs)

Write it as if the film does not exist. No title, no director, no "Get Out",
no "Peele".

> A psychological horror-thriller with social satire at its core. A young
> Black photographer visits his white girlfriend's wealthy family's country
> estate for the weekend and discovers a disturbing hidden agenda beneath
> their warm, polite hospitality. The film plays the sunny surface against
> the nightmare underneath, so the horror comes from recognising what is
> really going on rather than from violence. The tone is tense, ironic and
> pointed rather than gory: the scares are few, but every scene is loaded
> with what the characters will not say. Small cast, contained locations, and
> a story turning on the gap between how a family presents itself and what it
> actually is.

Keep the word chips the app proposes unless one is plainly wrong, and record
any edit you make — the word set is part of the result (§5.1).

## The two runs

Same pitch. Same word set. **Only the comps change.** That isolation is the
whole experiment: it shows whether the rivals move when the audience is
redefined.

**Run A — the creative lineage** (what the filmmaker actually knew)
Comps: `12 Years a Slave`, `Guess Who's Coming to Dinner`, `Rosemary's Baby`

**Run B — the industry reflex** (what the genre says)
Comps: `Us`, `The Babadook`

Do **not** use *Fences* as a comp in either run — it is part of the ground
truth (Universal paired the trailer with it). Using it would feed in the
answer. Do not use *Get Out* itself; that is circular.

## Pre-registered outcomes

Decided before running. Do not move the goalposts after you see a result.

| Outcome | What the runs show | How to report it |
|---|---|---|
| **HIT** | In Run A, the top audience is **not** the horror crowd, and a serious / conversation crowd appears among the rivals or the reach plan | "The tool found the crossover audience without being told" — this is the headline, and it is the only outcome that proves the product's thesis |
| **PARTIAL** | Run A names a serious-drama crowd; Run B names the horror crowd. The tool follows the comps faithfully instead of surprising | "A faithful mirror, not an oracle" — publish it anyway. A tool that reports honestly when the guess is right is still worth having, and the gap between Run A and Run B is itself the finding |
| **MISS** | Either run returns Weak or Inconclusive, or Run A names something unrelated to the documented audience | Publish it. This is the single most valuable thing we could learn this week |

**Watch for the surprise headline** (§6.7): if a rival beats the named
audience by the surprise margin (0.10), the result page says *"Your best fit
is not the audience you named."* In Run A, that would be the tool naming a
serious-film crowd over the lineage crowd. Screenshot it.

**Also record the hold-out delta** on the named row (§6.6, §10 #3). If the
named audience wins only on the titles it donated, the run self-fit collapses
and we have a circularity bug, not an audience finding. That failure mode is
worse than a MISS, because it means the tool is agreeing with the user for
the wrong reason.

## What to record

One row per run in `docs/backtest-results.md`:

| Field | Run A | Run B |
|---|---|---|
| Comps used | | |
| Word chips kept / edited | | |
| Verdict | | |
| Named audience (label + score) | | |
| Top rival (label + score) | | |
| Margin, named vs. top rival | | |
| Did a rival beat the named row by 0.10? | | |
| Hold-out delta on the named row | | |
| One reach-plan name that fits the "serious/conversation" side | | |
| Outcome (HIT / PARTIAL / MISS) | | |

---

## Quota: verified entity ids — do not re-search these

Every title below was resolved live against the hackathon dataset. All six
carry **50 taste tags** (judgement floor is 10), so none of them will strand
a run in no-data.

| Title | Qloo entity id | Tastes |
|---|---|---|
| Get Out (2017) | `052B6BB1-EDFA-4C49-A6FE-712DBB296B09` | 50 |
| 12 Years a Slave | `BB54D73D-AFF1-45DE-BC13-93723AAD9970` | 50 |
| Guess Who's Coming to Dinner | `520B28E5-FA40-49AC-9358-9495F4CF2987` | 50 |
| Rosemary's Baby | `638E17F1-D650-4596-9BE5-B82985A5AA69` | 50 |
| Us | `AB71C7D1-83C9-4A51-BA17-4328A8A8EBF4` | 50 |
| The Babadook | `74E75A1A-286C-45AB-9D06-B68E7D0076E9` | 50 |
| Fences | `49339C8F-ACD0-4659-81F4-2EB4CDE105F9` | 50 |

`Get Out` is confirmed as the 2017 Peele film: release year 2017,
disambiguation "2017", IMDb `tt5052448`, US. If the app's title check ever
reports a miss for one of these, that is a bug worth filing, not a data gap.

**Calls already spent on this prep:** 24 (8 title searches, 8 taste probes
with a faulty parser, 1 corrected taste probe, 1 full-entity search, 6 taste
depth checks). The two back-test runs are the only Qloo spend left.

## Sources

- Variety, "Get Out Tapped Into Relationship Between Horror and Racism"
  (2017-03-22) — Universal's marketing chief on the genre base not carrying
  the film, and the deliberate push outside genre.
  <https://variety.com/2017/biz/news/jordan-peele-get-out-marketing-racism-horror-1202012833/>
- AP, "In sensation of 'Get Out,' hints of a Trump-effect" (2017-03-13) —
  opening-weekend audience composition.
  <https://apnews.com/arts-and-entertainment-movies-general-news-18b36e0e9af042c99c4f6d26ac297015>
- The Guardian (2017-03-18) — "This is 12 Years a Slave: The Horror Movie";
  Peele on *Guess Who's Coming to Dinner* and *The Stepford Wives*.
  <https://www.theguardian.com/film/2017/mar/18/get-out-daniel-kaluuya-horror-movie-jordan-peele>
- Wikipedia, *Get Out* — box office, second-weekend drop, records.
  <https://en.wikipedia.org/wiki/Get_Out>
- Rotten Tomatoes (2017-02-26) — studio data: gender split and 51% over 25.
  <https://editorial.rottentomatoes.com/article/box-office-get-out-scares-up-a-huge-opening/>
