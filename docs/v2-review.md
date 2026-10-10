# V2 implementation review

Date: 2026-10-10

Scope: uncommitted v2 working-tree implementation against `HEAD` (`514105c`), including adopted `product-spec.md`, the originating `pipeline-redesign.md`, and the implementation/coverage findings. New v2 source files are untracked and were inspected directly; a tracked-only git diff does not include them.

The original review made no implementation changes. Authorized follow-up fixes are recorded at the end of this document.

## Assessment

The redesign is substantially implemented, with a useful separation between pitch interpretation, reference identity, provisional analogy, returned connections, frozen grouping, and downstream leads. Synthetic fixtures are explicitly synthetic; v1 contracts remain separate. The documented switch from movie/book discovery to movie/artist discovery is consistent with the plan's pilot-gated fallback.

However, this is not ready for sign-off. Existing tests pass but do not cover several integration and evidence-integrity failures reproduced below. In particular, creator confirmation is not tied to the bridge the creator saw, and the new request-scoped budgets sit above a transport that still retains v1 global quota state and uncounted retries.

Severity: P1 = fix before promoting v2; P2 = material correctness or reliability issue to address before relying on the affected path. Standards and Spec findings remain separate; no cross-axis severity ranking is implied.

## Standards / integration

No hard Server Component/path-alias convention breaches were found. The following are functional integration defects, not Fowler smell judgments.

### I1 — P1: ordinary navigation still runs v1

Locations: `src/app/page.tsx:1–18`, `src/components/site-header.tsx:22–35`.

The homepage still renders `PitchFlow`, and new-analysis navigation goes to `/`. Neither entry exposes `/analyze`; the sample link goes to `/run`. A user arriving normally continues through the old scoring pipeline even though the spec has adopted v2 (§§1, 5). Connect the primary analysis entry to v2 while preserving existing v1 result/replay paths and clearly identifying legacy samples.

### I2 — P1: evidence is not inspectable

Locations: `src/components/v2-result.tsx:179–191,222–258`, `src/lib/pipeline/v2/types.ts:322–335`.

Counts, entity relationships, and leads have no claim-to-call citations or evidence viewer. Result contracts preserve some provenance strings, but no structured call ledger with query parameters and returned evidence; full discovery/supporting retrievals are also omitted from the result. An external podcast/person link is not its supporting Qloo query. This blocks the checkability promised by §§6.8, 6.12. Preserve redacted, structured traces in the versioned result and connect factual claims to them.

### I3 — P2: manifest-null results cannot save, and persistence failure is ignored

Locations: `src/lib/demo/v2-store.ts:33–35,48–53`, `src/components/v2-analyze.tsx:90–93`.

Saving requires `manifest.runId`, but clarification, unsupported/unavailable outcomes, and comparison-led exploration can have a null manifest. Those results return false from saving; the UI ignores the result. A failed localStorage write is also ignored. Refresh can discard the latest outcome or restore an older run. Give every result a replay identity independent of its manifest and show when durable saving failed.

### I4 — P2: revising a restored result drops optional context

Location: `src/components/v2-analyze.tsx:232–237`.

After reload, the form's comparisons/contrasts are empty. Revise restores the pitch and type but not those saved fields. Submitting that revision loses context from the previous input (§6.1). Restore the complete input before opening the correction form.

### I5 — P2: successive analogy confirmations are not cumulative

Locations: `src/components/v2-result.tsx:39,82–105`, `src/components/v2-analyze.tsx:213–229`.

Only newly checked aspect IDs are sent. Previously confirmed bridges are no longer checkable as provisional and are not added to the new request, so confirming another analogy can revert earlier ones to provisional and remove hypotheses. Preserve prior confirmations only when their exact aspect/reference/analogy is unchanged. This is separate from S3's more serious confirmation-drift defect.

### I6 — P2: shallow replay validation permits render crashes

Locations: `src/lib/demo/v2-store.ts:57–71`, `src/components/v2-result.tsx:54–56`.

The load guard accepts a payload missing `brief`, with unknown state strings, or with malformed nested members. In the missing-brief case, `undefined !== null` and rendering dereferences `undefined.interpretation`. Validate the fields actually consumed by rendering, reject invalid versions/states, and quarantine invalid latest entries (§10 #15). Synthetic storage probes confirmed acceptance of malformed replay shapes.

### I7 — P2: a lost response falsely promises zero spend

Location: `src/components/v2-analyze.tsx:94–96`.

The catch message says “Nothing was spent.” A browser/network error can occur after server-side LLM/Qloo work has completed. Spend is unknown in that condition, and a retry may spend again. Use an honest uncertain-spend message; do not claim the analysis never ran (§5).

## Spec

### S1 — P1: v2 inherits a process-wide quota cap

Locations: `src/lib/qloo/v2-identity.ts:228`, `src/lib/qloo/v2-evidence.ts:148`, `src/lib/qloo/client.ts:82–84,233–245`.

V2 creates local budgets, but its adapters still call the v1 transport with module-global `networkCalls` and `responseCache`. The orchestrator never resets that counter, so separate v2 runs accumulate toward the old 150-call cap; a v1 reset can also interfere with shared state. This contradicts §10 #14's independent accounting. A synthetic fetch probe performed 151 distinct resolver calls with a fresh v2 budget each time: only 150 HTTP fetches occurred and the last identity became `request_failed`. Move v2 quota ownership into the actual transport seam rather than adding another wrapper counter.

### S2 — P1: retries bypass the advertised attempt ceiling

Locations: `src/lib/qloo/v2-identity.ts:225–232`, `src/lib/qloo/v2-evidence.ts:141–148`, `src/lib/qloo/v2-reach.ts:166–173`, `src/lib/qloo/client.ts:252–318`.

Adapters charge once per `qlooFetch` invocation, but the transport may issue multiple HTTP attempts. A synthetic resolver request with `ceiling=1` performed three HTTP fetches after two 503s and reported `used=1`. The 40-attempt policy therefore is not enforced (§8; §10 #16). Charge each real fetch, including retries, against the same request context; distinguish cache hits from HTTP attempts.

Related instrumentation limitation: `run.ts:238–239` counts one successful brief invocation, regardless of its internal repair/provider fallback; failed invocations are counted as zero. Failed explanation attempts are likewise omitted (`run.ts:783–790`). The displayed LLM usage cannot currently establish actual provider spend.

### S3 — P1: confirmation validates newly generated bridges

Locations: `src/lib/pipeline/v2/run.ts:238–239,284–317`, `src/lib/pipeline/v2/types.ts:94–99`.

A confirmation re-run generates a new LLM brief and references, then applies old positional IDs such as `a-1`. If the work, facet order, excerpt, or analogy changes, the new bridge can acquire creator confirmation intended for the old one. §6.9 requires re-running with **that bridge** as evidence. Bind confirmation to the exact previous aspect/reference/analogy and reject drift, or reuse the confirmed frozen bridge in the new version. The existing test uses an unchanged proposal. A synthetic reviewer probe confirmed replacement references receiving old confirmations.

### S4 — P1: unchecked prose is labeled grounded

Locations: `src/lib/agent/v2-explain.ts:93–102,172–196`.

Name validation only examines ASCII double-quoted spans. Unquoted invented works/people/channels and unsupported relationship claims can pass the regex screen and receive `source: llm-grounded`. A synthetic packet containing one allowed composer accepted an invented artist label and advice asserting that fans gather at an invented podcast. This violates §§6.12, 8 and §10 #13. Use structured entity/evidence references and code-rendered factual names/relations; do not rely on a quote convention or denylist for grounding.

### S5 — P1: duplicate pitch aspects can inflate corroboration

Locations: `src/lib/agent/v2-brief.ts:125–162`, `src/lib/pipeline/v2/discovery.ts:174–189`.

The parser accepts identical facet/excerpt/interpretation tuples and assigns each a different positional ID. Distinct confirmed references for those duplicate aspects then count as different dimensions. A synthetic parser probe accepted the same `theme/quiet/quiet` aspect twice. §10 #6 forbids duplicate aspects inflating corroboration. Enforce distinct facets and exact duplicate rejection at least; semantic independence still needs evaluation beyond syntax.

### S6 — P2: provider failures receive misleading result states

Locations: `src/lib/pipeline/v2/assess.ts:31–56`, `src/lib/pipeline/v2/run.ts:499–516`.

When references resolve but every retrieval fails, `composeStates` returns `no-supported-hypothesis/unavailable` instead of `unable-to-assess/unavailable`. Conversely, all identity failures can produce `dataState: complete` and the message that identity lookups completed. The first combination was reproduced with a synthetic failed retrieval. Missing-data conditions must stay distinct from completed negative/empty retrieval (§6.7; §10 #9). Also retain individual failed category/lookup details: the final result currently discards full retrieval outcomes, and discovery failures do not receive explicit limitations (`run.ts:683–693,798–811`).

### S7 — P2: partial descriptor agreement labels the entire overlap group

Location: `src/lib/pipeline/v2/discovery.ts:165–189`.

A descriptor needs only two holders, but the neighborhood includes every core entity, including unrelated ones lacking that descriptor. Those members can influence downstream lead seeds. A synthetic two-composer/one-punk example was accepted as a coherent film-score neighborhood containing all three. §6.5 requires metadata-grounded coherence. Form membership around the actual descriptor holders, or describe the broader set as overlap without assigning the subset's label to all members.

### S8 — P2: the run deadline does not bound in-flight calls

Locations: `src/lib/pipeline/v2/run.ts:188–189,238–239,551–564,783`, `src/lib/qloo/client.ts:252–263`, `src/lib/agent/llm-client.ts:59–60`.

Elapsed-time checks run between awaits. Provider requests, repair/fallback calls, retries, and backoff use their own timeouts without the remaining run deadline or a shared abort signal. Work started just before the deadline can continue well past it, contrary to §10 #16. Propagate cancellation and remaining time into the transport, not just stage-start checks. Existing deadline tests advance a synthetic clock rather than exercise slow in-flight calls.

## Coverage and product-value limits

- Public aggregate notes support the stated endpoint/shape checks, not universal audience usefulness. Artist overlap is reported for one near and one far pair; this is enough to motivate a pilot configuration, not validate general discrimination or demand.
- `toLens` currently produces only creator-confirmation or llm-provisional bridges. It never generates returned-metadata or curated-mapping support. First-time runs therefore cannot return pitch-supported hypotheses without confirmation. This is disclosed in the findings, but means automatic discovery value is still an open product question rather than an established benefit.
- `formNeighborhoods` creates at most one all-core candidate. Multi-neighborhood selection/ranking is not exercised by the live implementation; its sorting functions mostly prepare for future grouping.
- Known seed-family relationships are not retained (`run.ts:545` always freezes an empty `knownFamilyLinks`). Identical IDs are deduplicated, but distinct references from the same franchise/edition family are not established as independent. §10 #6's family-dependence requirement remains incomplete.
- The human pitch-pack checklist and cost table in `docs/v2-eval.md` remain empty. Adoption is recorded in the product spec, while actual human validation of fidelity and exploration usefulness is still owed. Endpoint success and synthetic unit-test success do not substitute for that gate.
- Findings/coverage headers still describe an unadopted lean release with features deferred, while later findings and the spec say those features landed. Update the document status summary so the active scope is unambiguous.

## Validation performed during this review

- Node v24.15.0, seven targeted v2 test files: **96 passed, 0 failed**.
- Full test suite, 28 files: **220 passed, 0 failed**.
- `pnpm typecheck --incremental false`: **passed**, without writing incremental build metadata.
- Synthetic, network-free reproductions: hidden process quota, undercounted retries, outage report state, descriptor contamination, duplicate aspects, and unquoted explanation inventions. Reviewer synthetic probes also checked confirmation/replay behavior.
- Validator exits were captured independently: exit 0. The terminal shell then emits `Cannot set tty process group` and wrapper exit 2; that wrapper error is not a failing test/compiler result.
- No live Qloo/LLM calls, dependency installs, dev servers, production builds, secret/env-file reads, or source edits were performed. The documented live pilot is reported evidence, not independently rerun evidence.

Summary: the original review identified 7 integration findings and 8 Spec findings. Passing synthetic tests alone does not establish audience usefulness.

## Authorized follow-up fixes (2026-10-10)

- I1–I7: homepage uses v2 while legacy v1 remains available; redacted query ledgers and call citations are inspectable; every outcome has a replay id; failed browser saving is visible and retryable without reanalysis; revisions retain context; confirmations are cumulative; malformed replay data is rejected; lost responses disclose unknown usage.
- S1–S2: v2 transport owns request-scoped quota/cache, charges actual HTTP attempts including retries, and records redacted responses/errors. LLM usage counts actual provider attempts, including failures, fallback, and repair.
- S3: confirmation carries the exact aspect/reference/analogy, reuses the reviewed brief without another proposal, and freshly resolves Qloo identity. Changed references cannot inherit positional approvals.
- S4–S5: explanations accept structured descriptor/member/advice selections only, with facts rendered in code; repeated facets/excerpts/readings cannot inflate evidence.
- S6–S8: total retrieval outages are unable-to-assess/unavailable; partial failures retain outcomes and limitations; descriptor membership excludes unrelated cores; coverage/support counts collapse known duplicate names; one shared deadline cancels provider fetches, response bodies, retry waits, and bounds injected awaits.
- Wider franchise dependence and statistical independence remain explicitly unverified. Automatic metadata-backed analogy approval and human usefulness evaluation remain open; a first run can honestly be exploration-only until appropriate bridges are confirmed.

Final integration validation: `tsc --noEmit --incremental false` passed (captured exit 0); scoped Biome check passed (exit 0). Earlier isolated agent suites passed, but no additional regression suite or production build was run after integration, at the user's request to stop excessive testing. No live Qloo/LLM calls or dependency installs were made. The shell's post-command TTY error is separate from the successful validator exits. User testing is the next check.
