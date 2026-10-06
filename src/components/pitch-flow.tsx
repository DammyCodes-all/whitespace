"use client";

/**
 * Two-step pitch flow: idea box first, sharpen step second. Owned by U.
 *
 * The first screen is one question — what are you making? — with a big
 * input, an example that skips the second step, and a single continue
 * action. Similar-to / nothing-like / work-type live on the sharpen step
 * once the idea exists, so the first click never feels like a form.
 */

import Link from "next/link";
import { useState } from "react";
import { PitchForm } from "@/components/pitch-form";
import { EXAMPLE_RUN_INPUT } from "@/lib/demo/example-run-input";
import type { ResolvedTitle } from "@/lib/types";

export function PitchFlow({
  found,
  notFound,
}: {
  found: ResolvedTitle[];
  notFound: string[];
}) {
  const [pitch, setPitch] = useState("");
  const [step, setStep] = useState<"idea" | "sharpen">("idea");
  const exampleHref = `/run?input=${encodeURIComponent(
    JSON.stringify(EXAMPLE_RUN_INPUT),
  )}`;
  const skipHref = `/run?input=${encodeURIComponent(
    JSON.stringify({
      pitchText: pitch.trim(),
      workType: "film",
      nothingLike: [],
      similarTitles: [],
      candidateWords: [],
      rivalProposals: [],
    }),
  )}`;

  if (step === "sharpen") {
    return (
      <section className="mt-8 border-t border-rule pt-8">
        <p className="font-mono text-xs tracking-tight text-ink-3">
          Step 2 · optional context
        </p>
        <h2 className="mt-2 font-serif text-2xl tracking-tight text-ink">
          Optional context that sharpens the fit.
        </h2>
        <p className="mt-2 max-w-prose text-body text-ink-2">
          Add what your idea is similar to and what it is nothing like. Both are
          optional; the run uses whatever you confirm.
        </p>
        <PitchForm found={found} notFound={notFound} initialPitch={pitch} />
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <Link
            href={skipHref}
            className="border border-rule px-4 py-2 text-sm text-ink transition-colors hover:border-ink-3 hover:bg-surface"
          >
            Skip and run
          </Link>
          <button
            type="button"
            onClick={() => setStep("idea")}
            className="font-mono text-xs text-ink-2 underline underline-offset-4 hover:text-ink"
          >
            Back to the idea
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-10">
      <label htmlFor="idea" className="block text-lg tracking-tight text-ink">
        What are you making?
      </label>
      <textarea
        id="idea"
        value={pitch}
        onChange={(e) => setPitch(e.target.value)}
        rows={6}
        placeholder="A quiet science-fiction film about a lonely worker on a space station."
        className="mt-3 w-full border border-rule bg-surface px-4 py-3 text-[15px] text-ink placeholder:text-ink-3"
      />
      <div className="mt-3 flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={() => setStep("sharpen")}
          disabled={pitch.trim() === ""}
          className="inline-block bg-ink px-5 py-2.5 text-sm text-paper transition-colors transition-transform duration-150 ease-out hover:bg-ink-2 active:scale-[0.97] disabled:cursor-not-allowed disabled:bg-rule disabled:text-ink-3"
        >
          Find my audience
        </button>
        <Link
          href={exampleHref}
          className="border border-rule px-4 py-2.5 text-sm text-ink transition-colors hover:border-ink-3 hover:bg-surface"
        >
          Try an example
        </Link>
      </div>
    </section>
  );
}
