"use client";

/**
 * The scored run, below the orb: the idea as it was read, the verdict,
 * the plain-chatbot comparison, and the collapsed evidence shelf.
 */

import type { ChatbotView } from "@/components/chatbot-preview";
import { FlowCompareView } from "@/components/flow-compare";
import { FlowResultView } from "@/components/flow-result-view";
import { IdeaCard } from "@/components/idea-card";
import { EvidencePanel } from "@/components/orb/evidence-panel";
import type { FlowResult } from "@/lib/flow/contract";
import { parseSimilarTitles } from "@/lib/flow/similar-titles";
import type { FlowStepRow } from "@/lib/flow/view-types";
import type { QlooCall } from "@/lib/types";

export interface LegResultsProps {
  result: FlowResult;
  similarTitles: string;
  steps: FlowStepRow[];
  chatbot: ChatbotView | null;
  chatbotError: string | null;
  compareLoaded: boolean;
  compareCalls: QlooCall[];
}

export function LegResults({
  result,
  similarTitles,
  steps,
  chatbot,
  chatbotError,
  compareLoaded,
  compareCalls,
}: LegResultsProps) {
  return (
    <section aria-label="Results" className="leg-in-swap mt-10">
      <IdeaCard
        pitch={result.pitch}
        meta={`${result.type} · live run · ${result.qlooCalls.total} Qloo calls`}
      />

      <div className="mt-8">
        <FlowResultView result={result} orangeVerdict={result.surprise} />
      </div>

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
      />
    </section>
  );
}
