"use client";

import { ChangeView } from "@/components/change";
import type { ChatbotView } from "@/components/chatbot-preview";
import { FlowEvidenceBlock } from "@/components/flow/flow-evidence-block";
import type {
  ChangedRun,
  FlowResult,
  FlowStepRow,
  QlooCall,
} from "@/components/flow/flow-types";
import { callToEvidence } from "@/components/flow/flow-types";
import { FlowCompareView } from "@/components/flow-compare";
import { GapsCard } from "@/components/flow-gaps";
import { FlowResultView } from "@/components/flow-result-view";
import LoadingState from "@/components/ui/loading-state";

/**
 * Done phase: idea card + verdict + gaps/change + compare + evidence.
 * Heading contracts: h1#flow-results-heading, h2#flow-idea-heading,
 * h2#flow-change-heading. Spec: §6.7, §6.8, §6.9, §6.11, §6.12.
 */
export function FlowResultsStep({
  result,
  similarList,
  steps,
  chatbot,
  chatbotError,
  compareLoaded,
  compareCalls,
  changed,
  changeBusy,
  changeError,
  constraint,
  onConstraintChange,
  onCheckChange,
}: {
  result: FlowResult;
  similarList: string[];
  steps: FlowStepRow[];
  chatbot: ChatbotView | null;
  chatbotError: string | null;
  compareLoaded: boolean;
  compareCalls: QlooCall[];
  changed: ChangedRun | null;
  changeBusy: boolean;
  changeError: string | null;
  constraint: string;
  onConstraintChange: (v: string) => void;
  onCheckChange: () => void;
}) {
  const evidence = {
    ...result.evidence,
    ...Object.fromEntries(
      [...compareCalls, ...(changed?.calls ?? [])].map((call) => [
        call.id,
        callToEvidence(call),
      ]),
    ),
  };
  return (
    <section aria-labelledby="flow-results-heading">
      <h1 id="flow-results-heading" className="sr-only">
        Results
      </h1>
      <section
        aria-labelledby="flow-idea-heading"
        className="rounded-[18px] border-2 border-outline bg-surface p-5 shadow-[4px_4px_0_var(--outline)] sm:p-7"
      >
        <p className="font-mono text-xs uppercase tracking-[0.14em] text-ink-3">
          The idea
        </p>
        <h2
          id="flow-idea-heading"
          className="mt-3 max-w-3xl font-serif text-2xl leading-tight tracking-tight text-ink sm:text-3xl"
        >
          {result.pitch}
        </h2>
        <p className="mt-3 font-mono text-xs text-ink-3">
          {result.type} · live run · {result.qlooCalls.total} Qloo calls
        </p>
      </section>

      <div className="mt-8">
        <FlowResultView result={result} orangeVerdict={result.surprise} />
      </div>

      {result.gaps.length > 0 && (
        <div className="mt-4 grid gap-4 md:grid-cols-12">
          <div className="md:col-span-7">
            <GapsCard group={result.gaps[0]} />
          </div>
          <div className="md:col-span-5">
            <h2
              id="flow-change-heading"
              className="text-lg tracking-tight text-ink"
            >
              Change and re-check
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-ink-2">
              A constraint can change the pitch, but the new version has to
              score higher to land.
            </p>
            <form
              className="mt-3"
              onSubmit={(e) => {
                e.preventDefault();
                onCheckChange();
              }}
            >
              <label
                htmlFor="flow-constraint"
                className="block font-mono text-xs text-ink-3"
              >
                Limit (for example a smaller budget)
              </label>
              <div className="mt-1 flex flex-col gap-2 sm:flex-row">
                <input
                  id="flow-constraint"
                  value={constraint}
                  onChange={(e) => onConstraintChange(e.target.value)}
                  maxLength={140}
                  placeholder="Lower budget"
                  className="min-w-0 flex-1 border-2 border-outline bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-3"
                />
                <button
                  type="submit"
                  disabled={constraint.trim() === "" || changeBusy}
                  className="btn-primary shrink-0 px-5 py-2 text-sm"
                >
                  {changeBusy ? "Checking…" : "Check change"}
                </button>
              </div>
            </form>
            {changeError !== null && (
              <p role="alert" className="mt-3 text-sm text-ink-2">
                {changeError}
              </p>
            )}
            {changed !== null && (
              <div className="mt-4">
                <ChangeView changed={changed} />
              </div>
            )}
          </div>
        </div>
      )}
      {result.gaps.slice(1).map((group) => (
        <div key={group.audienceId} className="mt-4">
          <GapsCard group={group} />
        </div>
      ))}

      {compareLoaded ? (
        <FlowCompareView
          result={result}
          similarTitles={similarList}
          chatbot={chatbot}
          error={chatbotError}
        />
      ) : (
        <output aria-live="polite" className="mt-12 block">
          <LoadingState label="Checking the plain chatbot" variant="Dots" />
        </output>
      )}

      <FlowEvidenceBlock
        steps={steps}
        evidence={evidence}
        totalCalls={
          result.qlooCalls.total +
          compareCalls.length +
          (changed?.calls.length ?? 0)
        }
      />
    </section>
  );
}
