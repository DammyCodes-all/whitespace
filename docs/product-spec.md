# Whitespace: product spec

Status: draft v2 — audience-discovery redesign adopted 2026-10-10 (see `docs/pipeline-redesign.md`, implemented under `src/lib/pipeline/v2/`). v1 implementation and saved runs stay frozen with their original meanings; v1 numeric verdicts are never reinterpreted as v2 evidence states.
Formerly named Groundtruth.
Team: three developers, full-time sprint.

Tagline: Before you ship, find out who it's actually for.

---

## 1. Summary

Whitespace is an agent that tells a creator which taste connections exist around their idea, which audience hypotheses those connections support, and where to start investigating.

A creator pastes an idea (a film, album, book, game or similar) with optional comparisons and creative contrasts. Whitespace reads the idea's distinct aspects, resolves reference works for each aspect, and discovers what taste neighborhoods surround those references in Qloo's data. It returns zero to three audience hypotheses with checkable evidence counts, or clearly labeled exploration when corroboration is unavailable — never a forced ranking, never a fit percentage.

Every claim links to the Qloo call it came from. If the data is missing, the app says so instead of guessing.

## 2. Problem

You make something for months. Friends say it's great. It launches, and the people who show up are the ones who already liked your last thing. You picked an audience, then checked it only against people who already liked you. Nobody compared it with the other audiences it could have fit, and nobody told you where to find them.

This is a scenario, not a finding. Nothing in this section is backed by a statistic yet. If the team finds a source, add it here. Until then the wording stays soft.

## 3. Users

User and buyer: the creator who chooses their own audience. Examples are an indie filmmaker, a musician, an author, a small game studio, or a restaurant concept owner. The creator uses the product directly and is the person it is built to serve. They can share the audience case with anyone they need to convince, but that person is not a user.

Whether creators will pay has not been checked. Authors are known to pay for research tools (Publisher Rocket is one example), and artist-data tools like Chartmetric exist, but nobody on the team has asked creators in the chosen domain. The cheapest check is to show a sample audience case to three or four of them and ask what they would do the next morning.

## 4. Goals, non-goals and claims we will not make

Goals

1. Give the user a result they can act on: plausible audience hypotheses, the taste connections supporting each one, and concrete leads for investigating how to reach them.
2. Make every number checkable by linking it to a Qloo call.
3. Say "no data", "exploration only", or "unable to assess" when that is the honest answer.
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

1. The user pastes an idea and chooses its type (never silently defaulted). Optional comparisons and creative contrasts are context, never prerequisites.
2. The app shows how it read the idea and which reference works represent each aspect — "we read this as X; this reference represents Y." The user corrects them; a correction starts a new version.
3. The user watches honest progress (never fabricated steps) while the pipeline interprets, resolves, retrieves, and assesses.
4. The user sees zero to three audience hypotheses with evidence, or clearly labeled exploration, plus limitations.
5. The user opens investigation leads (podcasts, people) seeded by the hypotheses.
6. Optionally, the user confirms a reference analogy and re-runs as a new version with that bridge as evidence.
7. The user saves the versioned result; reopening it replays without spending another analysis.

## 6. What it does

### 6.1 Input

The user provides the pitch text and the type of work. Comparisons ("similar to", up to two retrieved) and contrasts ("nothing like", up to five) are optional context. Skipping them still runs interpretation and discovery. Corrections reference a previous version and start a new one.

### 6.2 Interpretation

The pipeline reads the pitch into a structured brief: a one-sentence interpretation marked as interpretation, up to three distinct aspects (premise, theme, tone, form) with exact pitch excerpts, constraints and contrasts kept separate from taste signals, and unrepresentable aspects named rather than hidden. Excerpts are code-checked as exact substrings. A meaningless pitch returns zero aspects, never a padded brief.

### 6.3 Reference lenses

For each aspect the pipeline proposes at most two real reference works with a narrow analogy note, then resolves them through Qloo identity: resolved, ambiguous, not_found, or request_failed. The first search hit is never accepted merely because something came back.

Identity and bridge are separate facts: Qloo identifying the work does not verify why it represents the aspect. Only bridges backed by returned metadata, creator confirmation, or a reviewed curated mapping count toward hypothesis evidence; LLM-only analogies stay explicitly provisional exploration.

Creator comparisons form a separate overlay: resolved, shown under "because you mentioned these", retrieved once each, never pitch aspects, never corroboration votes. When the pitch itself yields no usable references, comparisons can still seed comp-led exploration.

### 6.4 Frozen manifest

Before retrieval the run freezes: input, brief, aspect-to-reference bridges with provenance, canonical seed ids (lens plus resolved comparison ids, all excluded from counted results), discovery versus supporting roles, target categories (movies + artists for the film pilot), retrieval depth, grouping policy, budget, and deadline.

### 6.5 Discovery and neighborhoods

Each discovery lens is queried separately into the same target categories (top-20 window). Taste neighborhoods are built in code from shared returned entities across at least two distinct aspect families, with coherence from shared returned metadata — never invented by the model. When no confirmed neighborhood survives, the same frozen overlap is shown once more as candidate audiences: what the grouping would support if the creator confirms the provisional analogies, with projected counts labeled as such. Candidates are display-only and never feed leads, explanations, or evidence. A supporting lens, when a third usable aspect exists, is retrieved after the freeze and can add evidence or reorder groups; it cannot create members. Detail enrichment (exact-name tag lookup, at most four) runs only when cores exist but no shared descriptor survives, and only reassesses coherence.

### 6.6 Evidence, not scores

Groups are ordered by lens coverage (distinct eligible aspects returning at least two member works/families), then corroboration (eligible aspect pairs sharing at least two member works/families), then supporting evidence, with a stable tie-break. Descriptor-backed membership includes only actual descriptor holders. Duplicate ids/names count once; wider franchise dependence and statistical independence are not assumed. Equal evidence is a tie. There are no fit percentages and no Strong/Split/Weak:

| Description | Meaning |
|---|---|
| Cross-aspect evidence | Distinct discovery lenses with eligible bridges share concrete returned works |
| Additional supporting evidence | The withheld supporting lens also returns multiple frozen core members |
| Discovery-only / partial evidence | Supporting retrieval is absent, failed, or aspects remain unassessed |
| Exploration only | Useful returned connections without a pitch-supported hypothesis |
| No supported hypothesis returned | Completed retrieval established no neighborhood; not audience rejection |

Contrasts are preserved as creative context and exact seeds are excluded; broad tastes are never subtracted. Missing data keeps its own state: failed capability, empty retrieval, top-K omission, and unrepresentable aspects are different limitations, and partial results keep their failure details.

### 6.7 Report states

The result carries a report state (hypotheses, exploration-only, no-supported-hypothesis, unable-to-assess, needs-clarification, unsupported) and a data state (complete, partial, unavailable). Material ambiguity asks for clarification; tool/app pitches are refused as unsupported rather than judged. A taste neighborhood is a pattern among returned works, not a measured community; a hypothesis is our interpretation of that pattern and Qloo does not validate demand for the pitch.

### 6.8 Investigation leads

For at most two neighborhoods, the app uses up to three frozen core ids each as interest signals to fetch podcasts and people. Leads are downstream starting points for conversations, kept separate from hypothesis evidence. Each lead shows its actual identity, supporting query, returned link when available, and an investigation action. Affinity is not evidence of submissions, sponsorship, reach, or conversion. Missing leads are acceptable; channels, URLs, and people are never invented. Brands, places, and maps stay out of scope until the core loop proves useful.

### 6.9 Change and re-check

Deferred. Any future rewrite feature must not optimize away creative identity or present score gaming as improvement. Today, revising the pitch starts a new version; confirming an analogy reuses the exact reviewed brief and selected reference, preserves prior unchanged confirmations, and rechecks catalog identity before that bridge can count as evidence.

### 6.10 Audience case (one page)

A printable page containing: the idea in one line, the interpretation, the hypotheses with evidence counts, exploration entries, investigation leads, and a limits section. The footer says the page is built from group-level taste data and does not predict outcomes. (Case export UI follows; the data contract — versioned result plus run id — is final.)

### 6.11 Chatbot comparison

The same pitch is sent to the same AI with no Qloo tools and a plain request: who is this for and where do I find them. The answer appears beside the Whitespace result. Every title in the chatbot's answer is then looked up in Qloo and marked "found in Qloo" or "not found". This turns the comparison into a measurement, not a claim. (Retained during migration; not promoted ahead of the core loop.)

### 6.12 Evidence trace

Every claim on screen links to the Qloo call behind it. A call can be opened to see what was asked and what came back. Every run is saved client-side by run id so it replays without calling Qloo again; replay never spends a new analysis. Public fixtures are synthetic and labeled as such — real Qloo payloads never enter the repository.

## 7. Who does what

| Component | Responsibility |
|---|---|
| Qloo | Entity identities, returned metadata, and taste relationships. The source of every title, tag, and taste connection |
| The AI | Reads the pitch into a brief, proposes reference analogies, and names/describes frozen neighborhoods as interpretation |
| Our code | Seed exclusion, frozen manifests, neighborhood grouping, corroboration counts, ordering, result states, structured explanation selection, code-rendered facts, and the check that everything came from Qloo |

The AI does not invent tags, titles, ids, scores, groups, or audiences, and it does not rank anything. The model selects a returned descriptor or frozen member ids and a reviewed investigation suggestion; our code renders names, relations, counts, and advice. Invalid selections get one repair or deterministic labels.

## 8. How the agent behaves

One server workflow owns the order, retries, query budget, evidence, and result: scope → interpret → resolve → freeze → retrieve → group → assess → reach → explain. The workflow decides:

1. Which candidate references to retry when Qloo cannot resolve them.
2. Whether usable lenses suffice for discovery, supporting, or exploration-only paths.
3. Whether enrichment re-checks coherence or the result stays reference overlap.
4. Whether reach and explanation yield to the deadline and budget.
5. When to ask for clarification versus report unable-to-assess.

Grounding check: the explanation validator accepts only frozen neighborhood ids, an exact returned descriptor or one to two actual member ids, and a reviewed advice key. Free prose and unknown fields are rejected, with one structured repair; double failure renders deterministic labels. Names, relations, counts, advice, and orderings come from code-owned fields. The chatbot comparison is exempt, because its purpose is to show ungrounded output.

Qloo capabilities were verified by the bounded pilot in `docs/qloo-coverage.md` (identity, typed retrieval, excludes, reach from non-film seeds, artist fallback, deterministic repeats) before discovery was built. Documentation lists capabilities; quota limits, signal semantics, and affinity calibration are deliberately not assumed.

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
| 1 | Plain pitch, no comparisons | Interpretation and resolution run automatically; no empty-input shortcut or hardcoded demo fallback |
| 2 | Creative fidelity | Negation, tone, form, and constraints survive extraction; no invented demographic or genre |
| 3 | Reference identity | Wrong type/year, misleading first hit, ambiguity, and unknown work are handled without silent acceptance |
| 4 | Bridge fidelity | Catalog identity and analogy support stay distinct; provisional bridges never claim corroborated findings |
| 5 | Seed independence | All frozen seeds (lens, supporting, comparison) are excluded from counted entities; overlay never enters grouping |
| 6 | Distinct lenses | Duplicate aspects/references/retries cannot inflate corroboration; family dependence is flagged |
| 7 | Supporting separation | Supporting results cannot change frozen membership or generate rescue seeds |
| 8 | Sparse overlap | Zero supported neighborhoods is valid; single-lens exploration is labeled; no automatic Weak verdict |
| 9 | Missing data | Timeout, failed capability, empty retrieval, top-K omission, and unresolved aspect remain different states |
| 10 | Metadata coherence | No shared returned metadata means no invented group label |
| 11 | Ordering | Fixture memberships yield exact counts, ties, and stable order; no hidden score averaging |
| 12 | Reach from discovery | A non-film-seeded neighborhood produces leads; missing leads are acceptable, never invented |
| 13 | Grounding | Every factual name/relation/count resolves to an allowed entity, excerpt, or evidence record |
| 14 | Concurrency | Two simultaneous runs keep independent attempt counts, ledgers, and replay identities |
| 15 | Replay | Saved artifacts reproduce the report without LLM/Qloo calls and never enter public fixtures |
| 16 | Time/cost | End-to-end latency and attempts are instrumented; the ceiling and deadline are enforced |

Human review (`docs/v2-eval.md`): a 9-pitch pack (familiar, mixed, tone-led, negation, unusual format, vague, nonsense, misleading comparison, ambiguity) judged for bridge fidelity and hypothesis usefulness. Qloo endpoint success alone is not a quality test. Nonsense must never become a brief; misleading comparisons must never leak into evidence.

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
| Must have | One domain shown in depth (film pilot: movies + artists), interpretation with correctable lenses, discovery with evidence states, investigation leads, versioned replay, evidence links |
| Should have | Audience case export, chatbot comparison promoted beside the result |
| Could have | Brands/places reach, curated bridge mappings, second domain |
| Cut first | Second domain, then brands/places, then change/re-check revival |

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

What sets Whitespace apart is discovery-led hypotheses with traceable evidence counts, honest exploration-only results instead of forced verdicts, investigation leads seeded by the hypotheses themselves, and a Qloo link behind every claim.

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

Whitespace reads distinct aspects (isolated-worker premise, quiet tone) and resolves a reference work for each. If the discovery lenses share returned works with a coherent descriptor and the creator confirms the analogies, the result is an audience hypothesis with coverage and corroboration counts, investigation leads seeded by its core works, and a plain-language reason marked as interpretation. If the lenses share nothing, the result is exploration-only: per-reference starting points with the gaps stated, not a Weak verdict. If the user named a comparison, it appears under creator context — never as evidence.

## Appendix B. Glossary

Reference lens: a resolved work standing for one pitch aspect, with identity and analogy-bridge recorded separately.
Bridge provenance: what backs an aspect→reference analogy — returned metadata, creator confirmation, curated mapping, or LLM-provisional.
Taste neighborhood: returned works shared across distinct aspect families with a coherent returned descriptor. Not a measured community.
Lens coverage (C): distinct eligible aspect families covering a neighborhood.
Corroboration (X): eligible aspect-family pairs sharing at least two core members.
Exploration only: useful returned connections without a pitch-supported hypothesis. Not a failure.
Comparison overlay: creator-named context, resolved and shown, never evidence.
No data: Qloo did not return enough to judge. Not the same as lack of interest.
v1 terms retired: hypothesis/rival/control audiences, pitch tags, fit scores, margins, Strong/Split/Weak verdicts. Frozen v1 runs keep their meanings; nothing is reinterpreted.
