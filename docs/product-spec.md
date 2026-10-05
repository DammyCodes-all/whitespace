# Whitespace: product spec

Status: draft v1, for the Qloo Agentic Hackathon (Devpost, deadline Oct 30, 2026)
Formerly named Groundtruth.
Team: three developers, full-time sprint.

Tagline: Before you ship, find out who it's actually for.

---

## 1. Summary

Whitespace is an agent that tells a creator which audience their idea fits, how strongly, and where to find those people.

A creator pastes an idea (a film, album, book, game or similar) and lists what it is similar to and what it is nothing like. Whitespace treats that list as a guess, not a fact. It builds rival audiences from other plausible readings of the pitch, adds unrelated control audiences, and compares all of them using Qloo's taste data. It then returns a verdict on fit, a reach plan (podcasts, people, brands and places the best-fit audience loves), what that audience loves that the pitch does not yet speak to, and a one-page audience case.

Every claim links to the Qloo call it came from. If the data is missing, the app says so instead of guessing.

## 2. Problem

You make something for months. Friends say it's great. It launches, and the people who show up are the ones who already liked your last thing. You picked an audience, then checked it only against people who already liked you. Nobody compared it with the other audiences it could have fit, and nobody told you where to find them.

This is a scenario, not a finding. Nothing in this section is backed by a statistic yet. If the team finds a source, add it here. Until then the wording stays soft.

## 3. Users

User and buyer: the creator who chooses their own audience. Examples are an indie filmmaker, a musician, an author, a small game studio, or a restaurant concept owner. The creator uses the product directly and is the person it is built to serve. They can share the audience case with anyone they need to convince, but that person is not a user.

Whether creators will pay has not been checked. Authors are known to pay for research tools (Publisher Rocket is one example), and artist-data tools like Chartmetric exist, but nobody on the team has asked creators in the chosen domain. The cheapest check is to show a sample audience case to three or four of them and ask what they would do the next morning.

## 4. Goals, non-goals and claims we will not make

Goals

1. Give the user a result they can act on: a named audience, a margin over the alternatives, and a concrete reach plan.
2. Make every number checkable by linking it to a Qloo call.
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

1. The user pastes an idea and chooses its type.
2. The app shows its suggested "similar to" titles, checked against Qloo. The user adds or removes titles. This list becomes the hypothesis audience.
3. The user lists a few things the idea is nothing like.
4. The user watches the agent work through its steps.
5. The user sees the verdict, the ranked audiences with margins, and any "no data" flags.
6. The user opens the reach plan for the best-fit audience.
7. Optionally, the user adds a limit (for example a smaller budget) and sees a suggested change with a before-and-after score, or a message saying the change did not clear the bar.
8. The user exports the one-page audience case and can compare the result with a plain chatbot's answer.

## 6. What it does

### 6.1 Input

The user provides the pitch text, the type of work, up to five "nothing like" titles (optional), and a constraint (optional). Long pitches are trimmed to roughly 300 words, with a notice.

### 6.2 Hypothesis audience

The agent picks out the key parts of the pitch (genre, mood, setting, themes, format) and proposes "similar to" titles. Each title is looked up in Qloo. Titles Qloo cannot find are dropped and listed as "not found". The user confirms or edits the list, and the confirmed titles form the hypothesis audience.

### 6.3 Rival audiences

The AI proposes three alternative readings of the same pitch. Each has a short name, a one-sentence reason, and three to five candidate titles. Every title is checked in Qloo, and the ones that don't resolve are dropped.

A rival must be genuinely different. If more than about a third of its titles overlap with the hypothesis audience or with another rival, the agent replaces it. If fewer than two valid rivals remain after retrying, the run continues with what exists and the result says so. The agent may build up to five rivals if the first three fail this test.

The AI writes the reasons. The titles and any numbers come only from Qloo.

### 6.4 Control audiences

The app builds a set of control audiences (about 20) from unrelated material in the same domain. Controls show how well the pitch scores against an audience it has nothing to do with.

### 6.5 Pitch tags

The AI suggests descriptive words from the pitch. Each word is checked against Qloo's tags. A word that matches a real tag becomes a pitch tag. A word that does not is marked "no data" and left out of scoring. The result always shows coverage, meaning how many of the suggested words matched.

### 6.6 Scoring

Qloo describes each audience as a list of tastes ranked by strength. The app compares the pitch tags with each audience's list and gives every audience a fit score from 0 to 1. A higher score means the audience's strongest tastes include more of what the pitch is about. Strengths are converted to ranks within each audience so that audiences with long and short lists can be compared fairly. The user can pin a few must-have tags, which count double.

A pitch tag missing from a long list counts as zero, meaning the audience does not over-index on it. A tag missing from a short or failed list is "no data" and is left out for that audience. The result shows how many tags were left out.

The "nothing like" titles form an exclusion audience. Its tastes are subtracted from each audience before scoring, so the pitch is not credited for matching an audience through things the creator wants to avoid. This design choice needs testing on real pitches. If it behaves badly, the fallback is to show an overlap warning instead.

### 6.7 Control test and verdict

An audience "clears control" when it beats the best control audience by a clear margin.

| Verdict | Meaning |
|---|---|
| Strong fit | The top audience clears control and is clearly ahead of the second |
| Split | The top two audiences both clear control and are close together |
| Weak fit | No audience clears control |
| Inconclusive | Too few of the pitch words matched Qloo tags, or too many audiences had no data |

If the top audience is not the one the user named and beats it clearly, the headline becomes "Your best fit is not the audience you named."

A low score caused by missing data is shown as "no data". The app says "this audience doesn't care about X" only when Qloo returned enough data to support it.

The exact margins and cutoffs are set in week 1 by testing on real pitches. They are not findings.

### 6.8 Reach plan

For the best-fit audience (and the runner-up if the verdict is Split), the app asks Qloo for related podcasts, people, brands and places, about five of each. Titles the user already listed are removed. Each item shows how strongly the audience loves it and links to its source.

City view (optional): the user picks one city. If Qloo's location data is detailed enough, the app shows where this taste concentrates on a map. If the data is thin, the map is hidden and the app says why. The map shows relative concentration only, never headcounts.

What the audience loves that the pitch lacks: tastes the best-fit audience ranks highly that the pitch does not contain. These are shown as a finding and feed the change check in 6.9. The app does not write pitch copy from them.

### 6.9 Change and re-check

The user can add a limit, such as a smaller budget or a shorter format. The agent proposes a changed pitch using the gaps found above, and the changed pitch is scored the same way.

The bar for "better enough" is set and recorded before the proposal is made. A change is accepted only if the fit score rises by at least the bar, coverage does not fall, every new tag matches Qloo, and the audience still clears control.

If any condition fails, the app withholds the change and states which condition failed. It then recommends checking the result with real people before the user spends more. A withheld change is a normal outcome and is shown as one.

### 6.10 Audience case (one page)

A printable page containing: the idea in one line, the verdict and margin, the named audience described by its titles, three to five evidence lines each linked to its Qloo call, the reach plan, what the audience loves that the pitch lacks, and a limits section listing "no data" items. The footer says the page is built from group-level taste data and does not predict outcomes.

### 6.11 Chatbot comparison

The same pitch is sent to the same AI with no Qloo tools and a plain request: who is this for and where do I find them. The answer appears beside the Whitespace result. Every title in the chatbot's answer is then looked up in Qloo and marked "found in Qloo" or "not found". This turns the comparison into a measurement, not a claim.

### 6.12 Evidence trace

Every claim on screen links to the Qloo call behind it. A call can be opened to see what was asked and what came back. Every run is saved so it can be replayed without calling Qloo again.

## 7. Who does what

| Component | Responsibility |
|---|---|
| Qloo | Looking up titles and tags, audience tastes, related items, location data. The source of every number, tag and title |
| The AI | Reads the pitch, proposes titles, rival readings and words, runs the steps, writes the sentences |
| Our code | The overlap rule, subtracting the nothing-like audience, scoring, the control test, the verdict, the change check, and the check that everything came from Qloo |

The AI does not invent tags, titles, scores or audiences, and it does not rank anything.

## 8. How the agent behaves

One agent runs the work. The order is mostly fixed, but the agent decides:

1. Which candidate titles to retry or replace when Qloo cannot find them.
2. How many rivals to build (three by default, up to five).
3. Whether the rivals are different enough or need replacing.
4. Whether the control test supports going on to the reach plan.
5. Whether to attempt a change when a constraint is given.
6. When to stop and report inconclusive.

Grounding check: after the AI writes anything, the app checks that every title and tag in it came from Qloo. Anything that did not is removed or retried, and results are not shown until the check passes. The chatbot comparison is exempt, because its purpose is to show ungrounded output.

The team has not tested Qloo's responses yet. The plan assumes the capabilities listed in Qloo's public documentation (title and tag lookup, audience tastes, related items, location data). Confirm each one in the day-one test.

## 9. Demo plan

Length: about 90 seconds.

1. State the problem in two sentences.
2. Paste a real pitch and confirm the "similar to" list.
3. Show the live run, then the verdict. If a real pitch produced a surprise, lead with it. If none did, say so and show how the control test protects against false confidence.
4. Open the reach plan and click one item through to its Qloo call.
5. Show one change that was accepted or withheld.
6. Show the chatbot comparison with the "not found in Qloo" marks.
7. End on the audience case page.

Prepare three or four real pitches in advance, plus saved runs for each in case the live service is slow. One saved run should be an inconclusive or withheld-change case, shown deliberately as a trust moment.

The demo domain is chosen by the day-one coverage test, not by preference. Film and music are the likeliest candidates, but that is a guess.

## 10. Acceptance tests

| # | Test | Pass condition |
|---|---|---|
| 1 | Grounding | Across 20 runs, every title and tag in the final output came from that run's Qloo results |
| 2 | Nonsense pitch | Three deliberately meaningless pitches return Weak or Inconclusive |
| 3 | Circularity gate | On at least four real pitches, record whether the top audience differs from the hypothesis audience. If it never does, stop and review the design before building more |
| 4 | No data | A pitch with unmatched words shows "no data" and never a low score standing in for it |
| 5 | Change refusal | A change that fails the bar is withheld and the page names the failed condition |
| 6 | Speed | A full run finishes in about 90 seconds. A saved demo run finishes in about 10 |
| 7 | Repeatability | Rerunning a saved pitch gives the same verdict |
| 8 | Trace | Every claim on the result and reach screens opens its Qloo call |
| 9 | Access | The live demo loads with no login and the repository is public |

Test 3 is a decision gate, not a pass or fail on shipping. A tool that always agrees with the user's guess is not worth building.

## 11. Risks

| Risk | Why it matters | Mitigation |
|---|---|---|
| Qloo may lack audience-level taste data in the chosen domain | The whole scoring approach depends on it | Day-one test. Choose the domain by the result |
| Results always match the user's guess | The product adds nothing | Rival readings, controls, test 3 |
| Result counts may reflect how many results were requested, not true totals | Any count-based claim would be wrong | Use ranks only. Make no claims about counts or audience size |
| Location data is thin for the chosen city | The city map would mislead | Make it optional and hide it when thin. Demo a city that tests well |
| Whether creators will pay is unverified | Judges ask who pays | Show the sample case to a few creators in the target group |
| Scope is too large for three people in about 25 days | An unfinished demo loses to a smaller finished one | Follow the cut line in section 12 |
| Quota or rate limits | A live demo could fail | Save results and prepare saved runs |
| AI slowdowns or errors during the demo | Same | Saved runs and a visible fallback |
| The name suggests gap finding | Judges may expect a market-gap tool | Explain the name in the pitch and make no unserved-market claims |
| Close neighbors on the hackathon list | Entries like CultureFit Guard, SponsorScout, CulturePilot and TasteCritic overlap in part | Lead with rival audiences, the control test and the withheld change |

## 12. Team, scope and timeline

Roles

| Person | Owns |
|---|---|
| 1 | The Qloo side: lookups, audiences, reach queries, and the day-one coverage test |
| 2 | Scoring: fit scores, the control test, the verdict, the change check, and the check that everything came from Qloo |
| 3 | The agent and everything the user sees: the run, the results, the reach plan, the audience case, and the saved runs |

Cut line

| Priority | Items |
|---|---|
| Must have | One domain shown in depth, hypothesis plus rivals plus control, scoring and verdict, reach plan (podcasts, people, brands, places), audience case, evidence links, chatbot comparison |
| Should have | Change and re-check |
| Could have | City map, a second domain |
| Cut first | City map, then the second domain, then multi-limit re-scoring |

Timeline (today is Oct 5)

| Dates | Work |
|---|---|
| Oct 5 to 7 | Qloo tests, domain choice, project setup |
| Oct 8 to 14 | The full pipeline working end to end, first version of the screens |
| Oct 15 to 21 | Reach plan, change check, audience case, chatbot comparison, evidence links |
| Oct 22 to 26 | Calibrate the margins on real pitches, build saved runs, polish, clean the repository |
| Oct 27 to 29 | Freeze features, rehearse the demo, submit |

Submit a day early. The deadline's time zone has not been checked.

## 13. Competition

These descriptions come from the vendors' own materials and have not been independently checked.

| Tool | What it does | How Whitespace differs |
|---|---|---|
| Cinelytic | Analytics for film financing and greenlight decisions, used by studios | Whitespace compares rival audiences using cross-domain taste data and aims at work with no track record |
| Greenlight Essentials | Screenplay analysis that identifies core audiences for indie filmmakers | Whitespace tests the user's guess against rivals and a control, and gives a reach plan |
| Chartmetric, Viberate, Soundcharts | Artist audience data by city | These start from an artist. Whitespace starts from an idea |
| Publisher Rocket | Amazon keyword and category research for authors | Amazon data only. No cross-domain taste |

What sets Whitespace apart is the rival audiences, the control test, honest "no data" handling, a change it will withhold, and a Qloo link behind every claim.

## 14. Open decisions

1. Demo domain, decided by the day-one test.
2. Which kind of creator to speak to first in the pitch (filmmakers, musicians, authors or small studios).
3. Final margins for the verdict in 6.7.
4. Whether the city map ships.
5. Whether any other sponsor technology or extra judging criteria on the Devpost page carry points. Check the page again before building.
6. Whether judges can use the demo without an account.
7. Repository license.
8. The deadline's time zone.

## 15. Submission checklist

1. The live demo loads with no login.
2. Public repository with a README covering setup, the Qloo calls used and the grounding check.
3. Description text that matches the brief, with no claims about outcomes or users.
4. Saved demo runs included.
5. Required Devpost fields complete, per the current rules on the page.

## Appendix A. Illustrative example (invented, not Qloo output)

Pitch: a quiet science-fiction film about a lonely worker on a space station.

The user's guess is fans of other slow science-fiction films. Whitespace builds two rival readings: readers of literary fiction about isolation, and listeners of ambient music. It also draws control audiences from unrelated material.

If the pitch tags (for example "slow-burn" and "solitude") score highest against the literary-fiction rival and clear the control by a clear margin, the headline says the best fit is not the audience the user named. The reach plan then lists podcasts, people, brands and places that audience loves, and the audience case packages the evidence.

If no audience clears control, the verdict is Weak fit and the app recommends checking with real people before the user spends more.

## Appendix B. Glossary

Hypothesis audience: the audience built from the user's own "similar to" titles.
Rival audience: an audience built from a different plausible reading of the same pitch.
Control audience: an audience built from unrelated material, used to see what a meaningless match looks like.
Pitch tags: real Qloo tags that match words from the pitch.
Coverage: the share of suggested words that matched a real Qloo tag.
Margin: the fit-score difference between two audiences.
No data: Qloo did not return enough to judge. Not the same as "doesn't care".
Inconclusive: the app cannot say anything reliable and says so.
