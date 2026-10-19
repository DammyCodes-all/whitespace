/**
 * Design-system showcase: the sections.
 *
 * Every one of these is a Server Component. Interactive inputs are
 * demoted to the client islands in `./demo-interactive.tsx`; everything
 * else stays on the server because it only renders props.
 *
 * The rules from design-direction.md §6 are the acceptance criteria for
 * this file, not suggestions: no number without evidence, every verdict
 * wears its word, and every absence reads "not measured".
 */

import type { ReactNode } from "react";
import { ChatbotPreview } from "@/components/chatbot-preview";
import { TagChipsDemo } from "@/components/demo/demo-interactive";
import { EvidenceCalls } from "@/components/evidence";
import { FlowClient } from "@/components/flow-client";
import { FlowCompareView } from "@/components/flow-compare";
import { FlowEntry } from "@/components/flow-entry";
import { FlowResultView } from "@/components/flow-result-view";
import { ReachPlan } from "@/components/reach";
import { RunSteps } from "@/components/run-steps";
import { RunStream } from "@/components/run-stream";
import { SavedRunPanel } from "@/components/saved-run-panel";
import { ScopeNotice } from "@/components/scope-notice";
import LoadingState from "@/components/ui/loading-state";
import { VerdictHeadline } from "@/components/verdict";
import {
  ABSENCE_SWATCHES,
  DEMO_CALLS,
  DEMO_CHATBOT,
  DEMO_EVIDENCE_LINES,
  DEMO_FLOW_RESULT,
  DEMO_GAPS,
  DEMO_MOCK_AUDIENCES,
  DEMO_PITCH_TEXT,
  DEMO_REACH_AUDIENCE,
  DEMO_RELATED,
  DEMO_STEPS_ACTIVE,
  DEMO_STEPS_PENDING,
  DEMO_UNLABELED_COUNT,
  DEMO_VERDICTS,
  NEUTRAL_SWATCHES,
  TEXT_SAFE_SWATCHES,
  TYPE_SPECIMENS,
  VERDICT_SWATCHES,
} from "@/lib/demo/design-system-data";

/* ─────────────────────────────────────────────────────────
 * Page furniture
 * ───────────────────────────────────────────────────────── */

export function Section({
  id,
  title,
  lede,
  children,
}: {
  id: string;
  title: string;
  lede: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="mt-16 scroll-mt-24">
      <h2 className="font-serif text-2xl tracking-tight text-ink">{title}</h2>
      <p className="mt-2 max-w-prose text-body text-ink-2">{lede}</p>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function Specimen({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <figure className="border-t border-rule pt-4">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-mono text-xs tracking-tight text-ink-3">
          {label}
        </span>
        {hint !== undefined && (
          <span className="font-mono text-xs text-ink-3">{hint}</span>
        )}
      </figcaption>
      <div className="mt-3">{children}</div>
    </figure>
  );
}

function SwatchChip({ swatch }: { swatch: (typeof NEUTRAL_SWATCHES)[number] }) {
  return (
    <div className="border-t border-rule pt-3">
      <div
        className="flex h-20 items-end justify-between p-3"
        style={{ background: swatch.value }}
      >
        <span
          className={`font-mono text-[11px] ${swatch.on === "ink" ? "text-ink" : "text-paper"}`}
        >
          Aa
        </span>
        <span
          className={`font-mono text-[11px] ${swatch.on === "ink" ? "text-ink" : "text-paper"}`}
        >
          {swatch.value}
        </span>
      </div>
      <p className="mt-2 font-mono text-xs text-ink">{swatch.name}</p>
      <p className="mt-0.5 text-sm text-ink-2">{swatch.note}</p>
    </div>
  );
}

function Notes({ children }: { children: ReactNode }) {
  return (
    <p className="mt-4 max-w-prose font-mono text-xs text-ink-3">{children}</p>
  );
}

/* ─────────────────────────────────────────────────────────
 * 1. Color
 * ───────────────────────────────────────────────────────── */

export function ColorSection() {
  return (
    <Section
      id="color"
      title="Color"
      lede="Four neutrals, four verdict fills, two text-safe colors, one texture for absence. Light only — no dark mode, and color never carries a verdict alone."
    >
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {NEUTRAL_SWATCHES.map((s) => (
          <SwatchChip key={s.name} swatch={s} />
        ))}
      </div>
      <h3 className="mt-10 font-mono text-xs tracking-tight text-ink-3">
        verdict fills · ink text on all of them
      </h3>
      <div className="mt-3 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {VERDICT_SWATCHES.map((s) => (
          <SwatchChip key={s.name} swatch={s} />
        ))}
      </div>
      <h3 className="mt-10 font-mono text-xs tracking-tight text-ink-3">
        when a verdict color has to be text on paper
      </h3>
      <div className="mt-3 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {TEXT_SAFE_SWATCHES.map((s) => (
          <SwatchChip key={s.name} swatch={s} />
        ))}
      </div>
      <h3 className="mt-10 font-mono text-xs tracking-tight text-ink-3">
        absence
      </h3>
      <div className="mt-3 grid gap-6 sm:grid-cols-3">
        {ABSENCE_SWATCHES.map((s) => (
          <SwatchChip key={s.name} swatch={s} />
        ))}
      </div>
      <Notes>
        Every ratio above was computed against the background it is shown on.
        Re-check any new pair before it ships; the readable-text floor is 4.5:1.
      </Notes>
    </Section>
  );
}

/* ─────────────────────────────────────────────────────────
 * 2. Type
 * ───────────────────────────────────────────────────────── */

export function TypeSection() {
  return (
    <Section
      id="type"
      title="Type"
      lede="One typeface per function, and no font doing two jobs. Bricolage carries headlines, Figtree carries UI and body, Plex Mono carries streaming numbers and raw payloads."
    >
      <div className="space-y-8">
        {TYPE_SPECIMENS.map((spec) => (
          <Specimen
            key={spec.role}
            label={`${spec.role} · ${spec.font}`}
            hint={spec.className}
          >
            <p className={spec.className}>{spec.sample}</p>
            <p className="mt-2 max-w-prose text-sm text-ink-3">{spec.usage}</p>
          </Specimen>
        ))}
      </div>
    </Section>
  );
}

/* ─────────────────────────────────────────────────────────
 * 3. Shape and surface
 * ───────────────────────────────────────────────────────── */

export function ShapeSection() {
  return (
    <Section
      id="shape"
      title="Shape and surface"
      lede="Chunky but flat. A 2px ink outline, a 16px radius and a hard 4px offset shadow with no blur. No glass, no gradients, no glow."
    >
      <div className="grid gap-8 md:grid-cols-2">
        <Specimen label=".card" hint="surface · 2px outline · 4px 4px 0 shadow">
          <div className="card p-5">
            <p className="font-serif text-lg text-ink">Card surface</p>
            <p className="mt-1 text-sm text-ink-2">
              The one card shape. Anything that needs a container uses this and
              nothing else.
            </p>
          </div>
        </Specimen>
        <Specimen label=".cite" hint="24px minimum touch target">
          <div className="flex items-center gap-3">
            <a href="#ds-call-search-1" className="cite">
              [e]
            </a>
            <span className="text-sm text-ink-2">
              A citation, not a button. Tapping opens the request and response.
            </span>
          </div>
        </Specimen>
        <Specimen
          label=".control-line + .control-pill"
          hint="solid ink, never dashed"
        >
          <div className="flex h-24 items-stretch gap-4">
            <div className="relative w-40 bg-surface">
              <div className="control-line absolute inset-y-0 left-1/2" />
              <span className="control-pill absolute -top-1 left-1/2 -translate-x-1/2">
                control
              </span>
            </div>
            <p className="max-w-prose self-center text-sm text-ink-2">
              The one graphic that is the product. Solid ink; dashes are
              reserved for not measured.
            </p>
          </div>
        </Specimen>
        <Specimen label=".nodata" hint="hatch + the words, always both">
          <p className="nodata px-3 py-2 font-mono text-xs text-ink-2">
            not measured
          </p>
        </Specimen>
      </div>
      <Notes>
        Print drops every fill to white, keeps outlines, drops shadows and keeps
        the hatch, so the verdict word does the work the color did.
      </Notes>
    </Section>
  );
}

/* ─────────────────────────────────────────────────────────
 * 4. Buttons
 * ───────────────────────────────────────────────────────── */

export function ButtonsSection() {
  return (
    <Section
      id="buttons"
      title="Buttons and actions"
      lede="Primary and secondary share the card shape and press in by 2px on :active. Anything quieter is a text link with an underline offset, never a second button style."
    >
      <div className="flex flex-wrap items-center gap-4">
        <button type="button" className="btn-primary px-6 py-3 text-sm">
          Primary action
        </button>
        <button type="button" className="btn-secondary px-6 py-3 text-sm">
          Secondary action
        </button>
        <span className="inline-block bg-ink px-5 py-2.5 text-sm text-paper">
          Ink run button
        </span>
        <span className="inline-block border border-rule px-5 py-2.5 text-sm text-ink">
          Outlined
        </span>
        <button
          type="button"
          className="font-mono text-xs text-measured underline underline-offset-4"
        >
          + add another
        </button>
        <button
          type="button"
          className="font-mono text-xs text-ink-3 underline underline-offset-4"
        >
          remove
        </button>
      </div>
      <Notes>
        Below 640px the primary and secondary actions become full-width rows,
        and no action anywhere depends on hover.
      </Notes>
    </Section>
  );
}

/* ─────────────────────────────────────────────────────────
 * 5. Loaders
 * ───────────────────────────────────────────────────────── */

export function LoadersSection() {
  return (
    <Section
      id="loaders"
      title="Loading state"
      lede="A pixel-grid loader for long-running work, paired with a shimmering label and a live elapsed timer in mono tabular figures. Reduced motion freezes the grid and keeps the timer ticking."
    >
      <div className="grid gap-8 sm:grid-cols-3">
        <Specimen label='variant="Drive"' hint="square cells">
          <LoadingState label="Churning" variant="Drive" />
        </Specimen>
        <Specimen label='variant="Dots"' hint="round cells">
          <LoadingState label="Running pitch" variant="Dots" />
        </Specimen>
        <Specimen label='variant="Orbit"' hint="perimeter comet">
          <LoadingState label="Checking in Qloo" variant="Orbit" />
        </Specimen>
      </div>
      <Notes>
        Tokens are ink cells with an ink-3 shimmer edge and an ink-3 timer, so
        the loader never introduces a color that carries meaning.
      </Notes>
    </Section>
  );
}

/* ─────────────────────────────────────────────────────────
 * 6. Inputs
 * ───────────────────────────────────────────────────────── */

export function InputsSection() {
  return (
    <Section
      id="inputs"
      title="Inputs"
      lede="Tag chips with live match status. Every chip is editable here; the run stays honest when you take words away."
    >
      <div className="space-y-12">
        <Specimen label="TagChips" hint="/components/tag-chips.tsx">
          <TagChipsDemo />
        </Specimen>
      </div>
    </Section>
  );
}

/* ─────────────────────────────────────────────────────────
 * 7. Absence and refusal
 * ───────────────────────────────────────────────────────── */

export function StatesSection() {
  return (
    <Section
      id="states"
      title="Absence and refusal"
      lede="Three states, not two: measured-high, measured-low, and not measured. Not measured gets a hatch, a dashed border, the words, and never a number."
    >
      <div className="space-y-10">
        <Specimen label="not found in Qloo" hint="clay is this one state only">
          <ul className="flex flex-wrap gap-2">
            <li className="nodata inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-clay">
              <span>loneliness</span>
              <span className="font-mono text-xs">not found in Qloo</span>
            </li>
            <li className="inline-flex items-center gap-1.5 border-2 border-outline bg-strong px-3 py-1.5 text-sm text-ink">
              space
            </li>
          </ul>
        </Specimen>
        <Specimen label="ScopeNotice" hint="/components/scope-notice.tsx">
          <ScopeNotice pitchText={DEMO_PITCH_TEXT} />
        </Specimen>
      </div>
    </Section>
  );
}

/* ─────────────────────────────────────────────────────────
 * 8. Run steps and evidence
 * ───────────────────────────────────────────────────────── */

export function EvidenceSection() {
  return (
    <Section
      id="evidence"
      title="Run steps and evidence"
      lede="A step appears when it actually finishes, with its counts. Every claim carries a citation dot, and the dot opens the exact request and response in mono — paths only, never the key."
    >
      <div className="space-y-12">
        <Specimen label="RunSteps · pending" hint="/components/run-steps.tsx">
          <RunSteps steps={DEMO_STEPS_PENDING} />
        </Specimen>
        <Specimen label="RunSteps · mid-run" hint="one active step">
          <RunSteps steps={DEMO_STEPS_ACTIVE} />
        </Specimen>
        <Specimen
          label="RunStream"
          hint="/components/run-stream.tsx · replays on mount"
        >
          <RunStream steps={DEMO_STEPS_ACTIVE} />
        </Specimen>
        <Specimen
          label="EvidenceCalls"
          hint="/components/evidence.tsx · claim-first, trace collapsed"
        >
          <EvidenceCalls calls={DEMO_CALLS} evidence={DEMO_EVIDENCE_LINES} />
        </Specimen>
      </div>
      <Notes>
        A 429 is a plain sentence in the trace, not an error color. Red is
        deliberately absent from this palette.
      </Notes>
    </Section>
  );
}

/* ─────────────────────────────────────────────────────────
 * 9. Verdicts
 * ───────────────────────────────────────────────────────── */

export function VerdictsSection() {
  return (
    <Section
      id="verdicts"
      title="Verdicts"
      lede="Five outcomes, each carrying its word. Mint, yellow and soft blue sit close in brightness and collapse together in grayscale, so the word is what a reader actually reads."
    >
      <div className="space-y-10">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { verdict: "strong", fill: "bg-strong", word: "Strong fit" },
            { verdict: "mixed", fill: "bg-split", word: "Mixed fit" },
            { verdict: "weak", fill: "bg-weak", word: "Weak fit" },
            { verdict: "inconclusive", fill: "bg-paper", word: "Inconclusive" },
          ].map((v) => (
            <div key={v.verdict} className={`card px-5 py-4 ${v.fill}`}>
              <p className="font-mono text-xs tracking-tight text-ink-2">
                {v.word}
              </p>
              <p className="mt-1 text-sm text-ink-2">
                {v.verdict === "inconclusive"
                  ? "We could not measure."
                  : "We measured, and here is where it landed."}
              </p>
            </div>
          ))}
        </div>
        <div className="space-y-10">
          {DEMO_VERDICTS.map((entry) => (
            <Specimen
              key={entry.label}
              label={entry.label}
              hint="/components/verdict.tsx"
            >
              <VerdictHeadline
                verdict={entry.verdict}
                pitchText={DEMO_PITCH_TEXT}
                context="on mocks"
              />
            </Specimen>
          ))}
        </div>
      </div>
    </Section>
  );
}

/* ─────────────────────────────────────────────────────────
 * 10. The result view
 * ───────────────────────────────────────────────────────── */

export function ResultViewSection() {
  return (
    <Section
      id="result"
      title="The result view"
      lede="Bars against the control ceiling, the reach plan beneath, and a targeting brief you can paste anywhere. Built on the adapter only — the null control score never reaches a number."
    >
      <Specimen label="FlowResultView" hint="/components/flow-result-view.tsx">
        <FlowResultView result={DEMO_FLOW_RESULT} />
      </Specimen>
      <Notes>
        The fourth audience has no judgeable score, so it renders as a
        not-measured row with no bar. The citation dots above jump to the call
        in the evidence section on this page.
      </Notes>
    </Section>
  );
}

/* ─────────────────────────────────────────────────────────
 * 11. Reach
 * ───────────────────────────────────────────────────────── */

export function ReachSection() {
  return (
    <Section
      id="reach"
      title="Reach plan"
      lede="Four category shelves per audience plus the loves-but-lacks gap list. Empty categories get the no-data state, never a zero, and gaps say out loud that they are research leads."
    >
      <Specimen label="ReachPlan" hint="/components/reach.tsx">
        <ReachPlan
          groups={[
            {
              audience: DEMO_REACH_AUDIENCE,
              headline: "Best fit",
              related: DEMO_RELATED,
              gaps: DEMO_GAPS,
              unlabeledCount: DEMO_UNLABELED_COUNT,
              hasTastes: true,
              tastesCallId: "ds-call-tastes-2",
            },
            {
              audience: DEMO_MOCK_AUDIENCES[2],
              headline: "Runner-up · Mixed verdict",
              related: DEMO_RELATED,
              gaps: [],
              unlabeledCount: 0,
              hasTastes: false,
            },
          ]}
        />
      </Specimen>
      <Notes>
        The second group has no taste data, so its gaps read as unknown rather
        than empty, and it carries no reach headline.
      </Notes>
    </Section>
  );
}

/* ─────────────────────────────────────────────────────────
 * 12. Compare
 * ───────────────────────────────────────────────────────── */

export function CompareSection() {
  return (
    <Section
      id="compare"
      title="Compare the readings"
      lede="Same pitch, two methods. Ours carries Qloo evidence; the chatbot gets no taste tools and its titles get checked in Qloo instead of trusted."
    >
      <div className="space-y-12">
        <Specimen
          label="FlowCompareView · measured"
          hint="/components/flow-compare.tsx"
        >
          <FlowCompareView
            result={DEMO_FLOW_RESULT}
            similarTitles={["Moon", "Arrival"]}
            chatbot={DEMO_CHATBOT}
            error={null}
          />
        </Specimen>
        <Specimen
          label="FlowCompareView · unavailable"
          hint="both sides withheld, neither invents a number"
        >
          <FlowCompareView
            result={DEMO_FLOW_RESULT}
            similarTitles={["Moon", "Arrival"]}
            chatbot={null}
            error="Chatbot comparison unavailable."
          />
        </Specimen>
        <Specimen label="ChatbotPreview" hint="/components/chatbot-preview.tsx">
          <ChatbotPreview chatbot={DEMO_CHATBOT} error={null} />
        </Specimen>
      </div>
    </Section>
  );
}

/* ─────────────────────────────────────────────────────────
 * 14. Whole screens
 * ───────────────────────────────────────────────────────── */

export function ScreensSection() {
  return (
    <Section
      id="screens"
      title="Whole screens"
      lede="The entry points and the live flow, rendered as they ship. These are the only parts of this page that touch the network: the flow calls /api/tags and /api/flow, and the saved-run panel reads localStorage."
    >
      <div className="space-y-12">
        <Specimen label="FlowEntry" hint="/components/flow-entry.tsx">
          <FlowEntry />
        </Specimen>
        <Specimen label="SavedRunPanel" hint="/components/saved-run-panel.tsx">
          <SavedRunPanel />
        </Specimen>
        <Specimen label="FlowClient" hint="/components/flow-client.tsx">
          <FlowClient initialPitch={DEMO_PITCH_TEXT} autoStart={false} />
        </Specimen>
      </div>
      <Notes>
        SavedRunPanel is a client-only island that reads localStorage and
        renders nothing until a run is saved, and the header and footer already
        wrap every page from the root layout — none of them has anything extra
        to show here.
      </Notes>
    </Section>
  );
}
