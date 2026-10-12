import type { Metadata } from "next";
import {
  ButtonsSection,
  ChangeSection,
  ColorSection,
  CompareSection,
  ConfirmSection,
  EvidenceSection,
  InputsSection,
  LoadersSection,
  ReachSection,
  ResultViewSection,
  ScreensSection,
  Section,
  ShapeSection,
  StatesSection,
  TypeSection,
  VerdictsSection,
} from "@/components/demo/demo-sections";
import { SiteFooter } from "@/components/site-footer";

/**
 * Design-system showcase. Internal tool, not a product screen.
 *
 * docs/product-spec.md does not define a design-system page, so this
 * carries no spec section — the source of truth for what it shows is
 * docs/design-direction.md, and the rules in its §6 are what this page
 * exists to check. Every value on it is a fixture; the screens section
 * is the only place that touches the network.
 */

export const metadata: Metadata = {
  title: "Design system: Whitespace",
  description:
    "Every component and token in the Whitespace design system, rendered live.",
};

const NAV = [
  { id: "color", label: "Color" },
  { id: "type", label: "Type" },
  { id: "shape", label: "Shape" },
  { id: "buttons", label: "Buttons" },
  { id: "loaders", label: "Loaders" },
  { id: "inputs", label: "Inputs" },
  { id: "states", label: "Absence" },
  { id: "evidence", label: "Evidence" },
  { id: "verdicts", label: "Verdicts" },
  { id: "result", label: "Result" },
  { id: "reach", label: "Reach" },
  { id: "change", label: "Change" },
  { id: "compare", label: "Compare" },
  { id: "confirm", label: "Confirm" },
  { id: "screens", label: "Screens" },
];

export default function DemoPage() {
  return (
    <>
      <main className="flex flex-1 flex-col">
        <div className="mx-auto w-full max-w-6xl px-6 py-12 sm:px-8">
          <p className="font-mono text-xs tracking-tight text-ink-3">
            design system
          </p>
          <h1 className="mt-2 max-w-3xl font-serif text-4xl leading-tight tracking-tight text-ink sm:text-5xl">
            How Whitespace looks, in one place.
          </h1>
          <p className="mt-4 max-w-prose text-body text-ink-2">
            Every token and every component, rendered with the same fixtures the
            product screens use. Internal reference — nothing here is a product
            screen, and the spec does not define one.
          </p>

          <nav
            aria-label="Sections"
            className="sticky top-0 z-10 -mx-6 mt-8 border-b border-rule bg-paper/95 px-6 py-3 backdrop-blur sm:-mx-8 sm:px-8"
          >
            <ul className="flex flex-wrap gap-x-5 gap-y-2">
              {NAV.map((item) => (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    className="font-mono text-xs text-ink-2 underline decoration-dotted decoration-ink-3 underline-offset-4 transition-colors hover:text-ink"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <Section
            id="foundations"
            title="How to read this page"
            lede="Sections run from the smallest unit outwards: tokens, then primitives, then the states that carry meaning, then whole screens. The page is a spec of record for the look, not a demo of the product."
          >
            <ul className="max-w-prose list-disc space-y-2 pl-5 text-body text-ink-2">
              <li>
                Every number shown is a fixture. Nothing here is a live Qloo
                result except inside the screens section, which is labeled.
              </li>
              <li>
                Every verdict carries its word, because mint, yellow and soft
                blue collapse together in grayscale and in print.
              </li>
              <li>
                Every absence reads &ldquo;not measured&rdquo; next to the
                hatch. A not-measured state never renders a number.
              </li>
            </ul>
          </Section>

          <ColorSection />
          <TypeSection />
          <ShapeSection />
          <ButtonsSection />
          <LoadersSection />
          <InputsSection />
          <StatesSection />
          <EvidenceSection />
          <VerdictsSection />
          <ResultViewSection />
          <ReachSection />
          <ChangeSection />
          <CompareSection />
          <ConfirmSection />
          <ScreensSection />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
