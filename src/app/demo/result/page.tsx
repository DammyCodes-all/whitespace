import type { Metadata } from "next";
import { FlowCompareView } from "@/components/flow-compare";
import { FlowResultView } from "@/components/flow-result-view";
import { IdeaCard } from "@/components/idea-card";
import {
  DEMO_CHATBOT,
  DEMO_FLOW_RESULT,
  DEMO_PITCH_TEXT,
} from "@/lib/demo/design-system-data";

export const metadata: Metadata = {
  title: "End result mock · Whitespace",
  description:
    "A static result-page mock for refining the Whitespace experience.",
};

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
