# Docs index

Current product docs (start with the spec; it is the source of truth for behavior):

- [product-spec.md](product-spec.md) — shipped behavior, scoring, verdict rules, acceptance tests, submission checklist.
- [design-direction.md](design-direction.md) — visual system and UI rules.
- [devpost-description.md](devpost-description.md) — submission text.
- [impact-evidence.md](impact-evidence.md) — every external figure, with sample sizes and caveats.
- [backtest.md](backtest.md) — pre-registered back-test protocol.
- [backtest-results.md](backtest-results.md) — Get Out results, including the PARTIAL outcome and the fixes that followed.
- [qloo-coverage.md](qloo-coverage.md) — chronological Qloo lab log, calibration, and live probes.
- [accessibility.md](accessibility.md) — contrast audit and the remaining manual checks.
- [build-tracker.md](build-tracker.md) — build log.

Historical documents (kept for the record; they do not describe current behavior):

- [v2-review.md](v2-review.md) — review of the removed v2 pipeline.
- [v2-findings.md](v2-findings.md) — implementation log for the removed v2 pipeline.
- [v2-eval.md](v2-eval.md) — evaluation plan for the removed v2 pipeline.
- [pipeline-redesign.md](pipeline-redesign.md) — proposal for the removed v2 pipeline.
- [build-plan.md](build-plan.md) — original v1 build plan.

The root [CONTEXT.md](../CONTEXT.md) records the product vocabulary and notes that the v2 pipeline was removed.

## Claim rule

- Every external figure in the submission text or README traces to [impact-evidence.md](impact-evidence.md), with its sample and caveat.
- Every product-behavior claim traces to [product-spec.md](product-spec.md).
- Prefer precise wording: titles, tags and entity IDs are grounded in Qloo calls; scores are computed in code from Qloo's ranked tastes.
