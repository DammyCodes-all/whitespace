import type { Metadata } from "next";
import { FlowCompareView } from "@/components/flow-compare";
import { FlowResultView } from "@/components/flow-result-view";
import { IdeaCard } from "@/components/idea-card";
import { ReachPlan } from "@/components/reach";
import {
  DEMO_CHATBOT,
  DEMO_FLOW_RESULT,
  DEMO_GAPS,
  DEMO_PITCH_TEXT,
  DEMO_REACH_AUDIENCE,
  DEMO_RELATED,
  DEMO_UNLABELED_COUNT,
} from "@/lib/demo/design-system-data";

export const metadata: Metadata = {
  title: "End result mock · Whitespace",
  description:
    "A static result-page mock for refining the Whitespace experience.",
};

const REACH_GROUPS = [
  {
    audience: DEMO_REACH_AUDIENCE,
    headline: "Best fit",
    related: DEMO_RELATED,
    gaps: DEMO_GAPS,
    unlabeledCount: DEMO_UNLABELED_COUNT,
    tastesCallId: "ds-call-tastes-2",
  },
];

export default function DemoResultPage() {
  return (
    <main id="main-content" className="flex-1">
      <div className="mx-auto w-full max-w-5xl px-6 py-10 sm:px-8 sm:py-14">
        <IdeaCard
          className="mt-10"
          pitch={DEMO_PITCH_TEXT}
          meta="film · fixture run · 11 Qloo calls saved"
        />

        <div className="mt-12">
          <FlowResultView result={DEMO_FLOW_RESULT} orangeVerdict />
        </div>

        <ReachPlan groups={REACH_GROUPS} />

        <FlowCompareView
          result={DEMO_FLOW_RESULT}
          similarTitles={["Moon", "Arrival"]}
          chatbot={DEMO_CHATBOT}
          error={null}
        />
      </div>
    </main>
  );
}
