"use client";

/**
 * The scored run, below the orb: the idea as it was read, the verdict,
 * the gap groups (with change-and-recheck beside the first one), the
 * plain-chatbot comparison, and the collapsed evidence shelf.
 */

import type { ChatbotView } from "@/components/chatbot-preview";
import { FlowCompareView } from "@/components/flow-compare";
import { GapsCard } from "@/components/flow-gaps";
import { FlowResultView } from "@/components/flow-result-view";
import { ChangeRecheck } from "@/components/orb/change-recheck";
import { EvidencePanel } from "@/components/orb/evidence-panel";
import type { FlowResult } from "@/lib/flow/contract";
import { parseSimilarTitles } from "@/lib/flow/similar-titles";
import type { FlowStepRow } from "@/lib/flow/view-types";
import type { ChangedRun } from "@/lib/pipeline/change";
import type { QlooCall } from "@/lib/types";

export interface LegResultsProps {
  result: FlowResult;
  similarTitles: string;
  steps: FlowStepRow[];
  chatbot: ChatbotView | null;
  chatbotError: string | null;
  compareLoaded: boolean;
  compareCalls: QlooCall[];
  changed: ChangedRun | null;
  changeBusy: boolean;
  changeError: string | null;
  constraint: string;
  onConstraintChange: (value: string) => void;
  onCheckChange: () => void;
}

export function LegResults({
  result,
  similarTitles,
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
}: LegResultsProps) {
  return (
    <section aria-label="Results" className="leg-in-swap mt-10">
      <section className="rounded-[18px] border-2 border-outline bg-surface p-5 shadow-[4px_4px_0_var(--outline)] sm:p-7">
        <p className="font-mono text-xs uppercase tracking-[0.14em] text-ink-3">
          The idea
        </p>
        <p className="mt-3 max-w-3xl font-serif text-2xl leading-tight tracking-tight text-ink sm:text-3xl">
          {result.pitch}
        </p>
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
            <ChangeRecheck
              constraint={constraint}
              onConstraintChange={onConstraintChange}
              busy={changeBusy}
              error={changeError}
              changed={changed}
              onCheck={onCheckChange}
            />
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
          similarTitles={parseSimilarTitles(similarTitles)}
          chatbot={chatbot}
          error={chatbotError}
        />
      ) : (
        <p className="mt-12 font-mono text-xs text-ink-3">
          Checking the plain chatbot…
        </p>
      )}

      <EvidencePanel
        result={result}
        steps={steps}
        compareCalls={compareCalls}
        changedCalls={changed?.calls ?? []}
      />
    </section>
  );
}
