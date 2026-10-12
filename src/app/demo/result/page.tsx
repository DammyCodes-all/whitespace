import type { Metadata } from "next";
import Link from "next/link";
import { ChangeView } from "@/components/change";
import { CompareView } from "@/components/compare";
import { FlowResultView } from "@/components/flow-result-view";
import { ReachPlan } from "@/components/reach";
import { VerdictHeadline } from "@/components/verdict";
import {
  DEMO_CHANGE_ACCEPTED,
  DEMO_CHATBOT,
  DEMO_FLOW_RESULT,
  DEMO_GAPS,
  DEMO_MOCK_AUDIENCES,
  DEMO_MOCK_SCORES,
  DEMO_MOCK_VERDICT,
  DEMO_PITCH_TEXT,
  DEMO_REACH_AUDIENCE,
  DEMO_RELATED,
  DEMO_UNLABELED_COUNT,
} from "@/lib/demo/design-system-data";

export const metadata: Metadata = {
  title: "End result mock · Whitespace",
  description: "A static result-page mock for refining the Whitespace experience.",
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
    <main className="flex-1">
      <div className="mx-auto w-full max-w-5xl px-6 py-10 sm:px-8 sm:py-14">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.14em] text-ink-3">
              Mock result · no API calls
            </p>
            <h1 className="mt-3 font-serif text-4xl leading-tight tracking-tight text-ink sm:text-5xl">
              Where the pitch lands.
            </h1>
            <p className="mt-3 max-w-2xl text-body text-ink-2">
              A static end-result page using saved fixture data. Change the
              layout and copy here while the live Qloo quota is unavailable.
            </p>
          </div>
          <Link
            href="/demo"
            className="rounded-full border-2 border-outline bg-surface px-4 py-2 font-mono text-xs text-ink shadow-[3px_3px_0_var(--outline)] transition-transform hover:translate-x-px hover:translate-y-px hover:shadow-[2px_2px_0_var(--outline)]"
          >
            Back to demo
          </Link>
        </div>

        <section className="mt-10 border-2 border-outline bg-surface p-5 shadow-[4px_4px_0_var(--outline)] sm:p-7">
          <p className="font-mono text-xs uppercase tracking-[0.14em] text-ink-3">
            The idea
          </p>
          <p className="mt-3 max-w-3xl font-serif text-2xl leading-tight tracking-tight text-ink sm:text-3xl">
            {DEMO_PITCH_TEXT}
          </p>
          <p className="mt-3 font-mono text-xs text-ink-3">
            film · fixture run · 11 Qloo calls saved
          </p>
        </section>

        <section aria-label="Verdict" className="mt-12">
          <VerdictHeadline
            verdict={DEMO_MOCK_VERDICT}
            pitchText={DEMO_PITCH_TEXT}
            context="on this mock"
          />
        </section>

        <FlowResultView result={DEMO_FLOW_RESULT} />

        <ReachPlan groups={REACH_GROUPS} />

        <section aria-label="Change and re-check" className="mt-12">
          <h2 className="text-lg tracking-tight text-ink">Change and re-check</h2>
          <p className="mt-1 max-w-prose text-sm leading-relaxed text-ink-2">
            A constraint can change the pitch, but the new version still has
            to clear the same measured bar.
          </p>
          <div className="mt-4 max-w-2xl">
            <ChangeView changed={DEMO_CHANGE_ACCEPTED} />
          </div>
        </section>

        <CompareView
          chatbot={DEMO_CHATBOT}
          error={null}
          audiences={DEMO_MOCK_AUDIENCES}
          scores={DEMO_MOCK_SCORES}
          verdict={DEMO_MOCK_VERDICT}
          topCallId="ds-call-tastes-2"
          chatbotCallId="ds-call-chatbot"
        />
      </div>
    </main>
  );
}
