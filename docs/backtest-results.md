# Back-test results: Get Out (2017)

Run 2026-10-20 against the live hackathon Qloo dataset. Protocol and
pre-registered rules: [`backtest.md`](backtest.md). Raw payloads are not
committed (§6.12); this file records aggregates and conclusions.

**Outcome: PARTIAL** — the tool was a faithful mirror that independently
surfaced the right flavour of rival, not an oracle. **Surprise rate: 0/2
(0%).** Details and the two real problems it exposed are below.

> **Post-run status (2026-10-20):** both problems below were acted on after
> this record was written. Control exclusion now uses "any shared title"
> (§6.4), and the fragility guard caps a fragile named audience at Mixed fit
> when its condition fires (§6.6–§6.7). The results themselves are unchanged
> and retained as the pre-fix record. The second film and the live re-check
> remain outstanding.

---

## The two runs

Same pitch, same word chips (`psychological horror`, `satire`,
`country estate`, `photographer`, `racial tension`, `tense` matched;
`class disparity` not found), same pitch tags. **Only the comps changed.**

| | Run A | Run B |
|---|---|---|
| Comps | 12 Years a Slave, Guess Who's Coming to Dinner, Rosemary's Baby | Us, The Babadook |
| Verdict | **Strong** | **Strong** |
| Ceiling (strangers baseline) | 0.0409 | 0.0261 |
| Surprise headline | false | false |
| Named audience | 0.1063 | **0.5987** |
| Pooled tags | 32 (26 titles, 6 pitch) | 23 (18 titles, 5 pitch) |
| AI bridges | 2 (racial tension→racism *strong*; tense→Thriller *related*) | 1 (country estate→period drama *strong*) |
| Grounding | 88 ids, 37 tags, all from this run | clean |

**Absolute scores are not comparable across runs** — the pooled tag set
differs, so a 0.60 vs a 0.11 says nothing on its own. Compare within a run.

### Run A — ranked

| Row | Audience | Score |
|---|---|---|
| named | People who like the Movies you named (12YAS / GWCDD / Rosemary's Baby) | 0.1063 |
| control | **Horror** | **0.1065** |
| control | Western | 0.0943 |
| control | Prestige drama | 0.0941 |
| control | Foreign drama | 0.0938 |
| rival | Fans of *This Is Me: A Story of Who We Are and Where We Came From* | 0.0499 |
| rival | Fans of *All My Rage* | 0.0311 |
| rival | Fans of *Rihanna* | 0.0301 |

Named tag hits: based on true story, period drama, Novels, Literary Fiction,
police investigation, racial tension→racism, tense→Thriller.

Reach plan (named audience): interests Classics / Literature / Fiction /
Novels / Literary Fiction · people Goldie Hawn, Kevin Bacon, Helen Hunt,
Pamela Adlon, Jane Fonda · podcasts The Bugle, Radiolab, The Infinite Monkey
Cage, Stuff To Blow Your Mind, Stuff You Should Know · brands Fitbit, Airbnb,
LA Kings, Victoria's Secret, GoPro · places Top of The Rock, Strawberry
Fields, One Times Square, Brooklyn Bridge, Park Güell.

Gaps: Classics, Literature, Fiction, American, Contemporary, 20th Century,
marriage, widow.

### Run B — ranked

| Row | Audience | Score |
|---|---|---|
| named | People who like the Movies you named (Us / The Babadook) | 0.5987 |
| control | **Horror** | **0.3773** |
| control | Fantasy | 0.0901 |
| control | Superhero | 0.0800 |
| rival | Fans of *Frantic* | 0.0497 |
| rival | Fans of *This Is Me* | 0.0497 |
| rival | Fans of *Rihanna* | 0.0059 |

Named tag hits: Graphic Novels & Comics, Race, demon, cult, sweden, house,
psychological horror, supernatural horror, ghost, gore, serial killer, evil,
satire.

Gaps: female protagonist, Queer, surrealism, teenager, murder, violence.

### Hold-out rounds (§6.6, §10 #3)

| Run | Round | Named | Top |
|---|---|---|---|
| A | without 12 Years a Slave (7 tags) | 0.11 → **0.01** (Δ −0.10) | 0.11 → 0.04 (Δ −0.07) |
| A | without Guess Who's Coming to Dinner (12 tags) | 0.11 → 0.17 (Δ +0.06) | 0.11 → 0.17 (Δ +0.06) |
| A | without Rosemary's Baby (7 tags) | 0.11 → 0.13 (Δ +0.03) | 0.11 → 0.13 (Δ +0.03) |
| B | without Us (12 tags) | 0.60 → 0.40 (Δ −0.20) | 0.60 → 0.40 (Δ −0.20) |
| B | without The Babadook (6 tags) | 0.60 → 0.54 (Δ −0.06) | 0.60 → 0.54 (Δ −0.06) |

---

## What the test found

### It worked — the tool surfaced the documented audience

The ground truth is that Get Out's audience **was not the horror crowd**. It
transcended genre; the growth came from the culturally-engaged,
conversation-driving side (39% Black opening-weekend audience, "It created a
conversation", a 15% second-weekend drop against horror's 60% floor).

**Run A found exactly that crowd, from data, without being told.** The
strongest rival it discovered was **Fans of *This Is Me: A Story of Who We
Are and Where We Came From*** — a documentary about African American history
and identity — and second was **Fans of *All My Rage***, a documentary about a
Black woman's murder and the failure of the justice system. Neither has any
connection to the comps the user typed. Qloo's graph connected this pitch to
the Black-history and social-justice documentary crowds on its own.

The reach plan's podcast column agrees: The Bugle, Radiolab, The Infinite
Monkey Cage, Stuff to Blow Your Mind, Stuff You Should Know — the
conversation crowd.

**And in Run A the named audience did not simply win by default.** The Horror
row (0.1065) and the named row (0.1063) were a statistical dead heat — the
tool came within 0.02% of calling the horror crowd the top audience on a
serious-drama comp set.

### It did not work — the tool mirrored the comps

Give it horror comps, it says horror. Run B returned a 0.5987 horror crowd
and a 0.3773 Horror control, and the tool's answer was "horror people",
unconditionally. **The surprise headline never fired in either run.** No rival
beat the named audience by the 0.10 surprise margin (§6.7).

So the product does not, today, answer "your best fit is not the audience you
named" from a taste-based read alone. It answers it only when the user's comps
are wrong *and* the rival happens to clear the bar. The mirror is honest and
the rivals are genuinely informative — but the wow headline is not yet earned
by the data.

### Verdict against the pre-registered rules

**PARTIAL.** Run A's top audience was not the horror crowd and the
serious/conversation crowds surfaced as rivals; Run B named the horror crowd,
as it should when given horror comps. Faithful mirror, correct rivals, no
surprise.

---

## Two real problems this exposed

### 1. The Horror control contains Get Out

`src/lib/qloo/control-seeds.ts:33` —

```
name: "Horror",
titles: ["Halloween", "A Nightmare on Elm Street", "Get Out"],
```

For this backtest the "other-genre comparison field" **contained the film
under test**. The Horror row is not an independent baseline; it is Get Out's
own crowd. Any horror pitch will hit this.

The §6.4 pitch-aware rule does not catch it: it excludes a control only when
it shares *more than a third* of its titles with the named audience. Name
`Get Out` as a comp and the Horror control shares 1 of 3 titles with a
3-title named audience — exactly one third, not more — so it stays in.

It did not corrupt this verdict: the ceiling came from the strangers
baseline (0.0409), not from the control field, and the controls were shown as
context bars rather than the line (§6.4). But the *row* is mislabelled for
this subject, and the exclusion threshold is too loose.

### 2. Run A's named audience was leaning on one comp

Remove 12 Years a Slave's 7 tags and the named audience falls from 0.11 to
**0.01** — it becomes the worst row in the table. The other two hold-outs
went *up* (+0.06, +0.03), so this is not the §10 #3 pattern in full, but the
signed asymmetry is real: a broad, multi-taste comp (Guess Who's Coming to
Dinner) dilutes every audience, while a distinctive one (12 Years a Slave)
carries the named row on its own.

With three comps, one title should not be able to hold the verdict. Worth a
guard: a named audience whose score collapses further than the field's when
one of its own gifts is removed should read as **fragile**, not Strong.

---

## What this changes

1. **Publish this.** It is a real back-test with a real outcome, a real
   partial result, and two named problems. That is more credible than a
   demo that always agrees with you. Publish the **0/2** surprise rate and
   do not lower the surprise margin to make the banner fire; the threshold
   is calibrated against noise, not against the copy.
2. **The rivals are the story, not the verdict.** Run A's rival set —
   *This Is Me*, *All My Rage* — is the part that shows the tool knows things
   the user did not tell it. Lead with that, not with "Strong fit".
3. **Fix the control threshold.** (Done 2026-10-20.) Exclude a control that
   shares *any* title with the named audience, not more than a third.
4. **Consider a fragility guard** on the named row when a single hold-out
   collapses it past the field. (Shipped 2026-10-20.)

## Call cost

Two runs, ~26 Qloo calls total. The control field (20 audiences) was served
from the 30-minute cache, which is why Run B finished in 28s against Run A's
107s. Tag extraction cost 6 more on top. Prep (entity + taste-depth checks)
was 24 — more than it needed to be. **No further calls without sign-off.**

## Still to do

Deferred deliberately, in cost order:

1. **The demo URL** — Devpost requires external hosting. No Qloo cost.
2. **A second film** — so this is n=2, not n=1. ~13 Qloo calls, and only
   worth it once the control threshold is fixed.
3. **The reverse pair** (genre pitch, serious comps) — ~13 Qloo calls to
   check the mirror runs both ways. Nice-to-have, not needed for the
   submission.
4. ~~**Fix the control threshold** (§6.4) and **consider the fragility guard**.~~
   **Done 2026-10-20:** the exclusion is now "any shared title" and the
   fragility cap shipped. A live re-check is still outstanding.
