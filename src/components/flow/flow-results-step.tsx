"use client";

import type { ChatbotView } from "@/components/chatbot-preview";
import { FlowEvidenceBlock } from "@/components/flow/flow-evidence-block";
import type {
  FlowResult,
  FlowStepRow,
  QlooCall,
} from "@/components/flow/flow-types";
import { callToEvidence } from "@/components/flow/flow-types";
import { FlowCompareView } from "@/components/flow-compare";
import { FlowResultView } from "@/components/flow-result-view";
import { IdeaCard } from "@/components/idea-card";
import LoadingState from "@/components/ui/loading-state";
import { isMockRun } from "@/lib/flow/contract";

/**
 * Done phase: idea card + verdict + compare + evidence.
 * Heading contracts: h1#flow-results-heading, h2#flow-idea-heading.
 * Spec: §6.7, §6.11, §6.12.
 */
export function FlowResultsStep({
  result,
  similarList,
  steps,
  chatbot,
  chatbotError,
  compareLoaded,
  compareCalls,
}: {
  result: FlowResult;
  similarList: string[];
  steps: FlowStepRow[];
  chatbot: ChatbotView | null;
  chatbotError: string | null;
  compareLoaded: boolean;
  compareCalls: QlooCall[];
}) {
  const evidence = {
    ...result.evidence,
    ...Object.fromEntries(
      compareCalls.map((call) => [call.id, callToEvidence(call)]),
    ),
  };
  const qlooDataCalls = result.qlooCalls.network + result.qlooCalls.cached;
  const runMeta = isMockRun(result)
    ? `${result.type} · mock run, no Qloo key, no Qloo data`
    : `${result.type} · live run · ${qlooDataCalls} Qloo calls`;
  return (
    <section aria-labelledby="flow-results-heading">
      <h1 id="flow-results-heading" className="sr-only">
        Results
      </h1>
      <IdeaCard
        headingId="flow-idea-heading"
        pitch={result.pitch}
        meta={runMeta}
      />

      <div className="mt-8">
        <FlowResultView result={result} orangeVerdict={result.surprise} />
      </div>

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
        totalCalls={result.qlooCalls.total + compareCalls.length}
      />
    </section>
  );
}
