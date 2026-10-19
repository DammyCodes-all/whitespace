import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { OrbFlow } from "@/components/orb-flow";
import { startPitch } from "@/lib/flow/start-pitch";

export const metadata: Metadata = {
  title: "Running: Whitespace",
  description: "The run, step by step — tags, titles, and the scored verdict.",
};

/**
 * The blank run page. Landing hands the pitch over as ?pitch= and the
 * move is transitioned (View Transition morph where supported, fade
 * fallback elsewhere — see EntryBox). OrbFlow auto-starts from the
 * param, so the orb's work happens here, never on the landing page.
 * The run runs at 0.85 pace: a beat slower than utility UI, on purpose.
 *
 * A direct hit with no usable pitch has nothing to run — entry lives on
 * the landing page — so it redirects home instead of rendering an empty
 * stage. The param is trimmed here, so a whitespace-only pitch counts
 * as none.
 *
 * Spec ref: §5.
 */
export default async function RunPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  if (startPitch(params) === "") redirect("/");
  return (
    <main id="main-content" className="page-enter flex flex-1 flex-col">
      <Suspense>
        <OrbFlow speed={0.85} />
      </Suspense>
    </main>
  );
}
