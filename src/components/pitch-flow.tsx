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
import { useRef, useState } from "react";
import { PitchForm } from "@/components/pitch-form";
import { EXAMPLE_RUN_INPUT } from "@/lib/demo/example-run-input";

export function PitchFlow() {
  const [pitch, setPitch] = useState("");
  const [step, setStep] = useState<"idea" | "sharpen">("idea");
  const [emptyNudge, setEmptyNudge] = useState(false);
  const ideaRef = useRef<HTMLTextAreaElement>(null);
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
        <PitchForm initialPitch={pitch} />
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
    <section className="mt-12">
      <label htmlFor="idea" className="sr-only">
        What are you making?
      </label>
      <textarea
        id="idea"
        ref={ideaRef}
        value={pitch}
        onChange={(e) => setPitch(e.target.value)}
        onFocus={() => setEmptyNudge(false)}
        rows={5}
        placeholder="A tender sci-fi drama for people who like slow-burn stories, with a lonely and hopeful feel."
        className="mt-3 min-h-40 w-full resize-y border border-ink-2 bg-surface px-5 py-4 text-left text-[15px] leading-relaxed text-ink placeholder:text-ink-3 transition-colors focus:border-ink focus:outline-none focus:ring-2 focus:ring-measured/30"
      />
      <div className="mt-5 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={() => {
            if (pitch.trim() === "") {
              setEmptyNudge(true);
              ideaRef.current?.focus();
              return;
            }
            setStep("sharpen");
          }}
          className="inline-flex min-h-11 items-center justify-center bg-ink px-6 py-3 text-sm text-white transition-colors transition-transform duration-150 ease-out hover:bg-ink-2 active:scale-[0.97]"
        >
          Find my audience
        </button>
        <Link
          href={exampleHref}
          className="inline-flex min-h-11 items-center justify-center border border-ink-2 px-6 py-3 text-sm text-ink transition-colors hover:border-ink hover:bg-surface"
        >
          Try an example
        </Link>
      </div>
      {emptyNudge && (
        <p role="alert" className="mt-3 text-center text-sm text-ink-2">
          Start with a sentence about what you&apos;re making.
        </p>
      )}
    </section>
  );
}
