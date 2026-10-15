import type { Metadata } from "next";
import { Suspense } from "react";
import { OrbFlow } from "@/components/orb-flow";

export const metadata: Metadata = {
  title: "Running: Whitespace",
  description: "The run, step by step — tags, titles, and the scored verdict.",
};

/**
 * The blank run page. Landing hands the pitch over as ?pitch= and the
 * move is transitioned (View Transition morph where supported, fade
 * fallback elsewhere — see EntryBox). OrbFlow auto-starts from the
 * param, so the orb's work happens here, never on the landing page.
 *
 * Spec ref: §5.
 */
export default function RunPage() {
  return (
    <main className="page-enter flex flex-1 flex-col">
      <Suspense>
        <OrbFlow />
      </Suspense>
    </main>
  );
}
