"use client";

/**
 * Landing entry for the audience flow. Owned by U.
 *
 * One text box, one action: the pitch goes straight into the new flow
 * (`/flow?pitch=…`), which auto-starts tag extraction. No intermediate
 * button, no second form. Type defaults to film; the flow's tag step
 * offers "Edit the pitch" for anything else.
 */

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

const PLACEHOLDER =
  "Tell us about your story: premise, mood, themes, and setting. More detail means better tags. Something like: a gritty but tender heist movie about loyalty and aging out.";

const EXAMPLE_PITCH =
  "Frankie drove getaway cars for twenty years and never lost a crew — now her old crew is back with one last casino job, and her teenage nephew begs to ride along. Gritty but tender, about loyalty and aging out; a heist movie with family drama at its core, not a glossy action romp.";

export function FlowEntry() {
  const router = useRouter();
  const [pitch, setPitch] = useState("");
  const [emptyNudge, setEmptyNudge] = useState(false);
  const ideaRef = useRef<HTMLTextAreaElement>(null);

  function start(pitchText: string) {
    const trimmed = pitchText.trim();
    if (trimmed === "") {
      setEmptyNudge(true);
      ideaRef.current?.focus();
      return;
    }
    const params = new URLSearchParams({ pitch: trimmed });
    router.push(`/flow?${params.toString()}`);
  }

  return (
    <section aria-label="Start the audience flow" className="mt-12 w-full">
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
        placeholder={PLACEHOLDER}
        className="mt-3 min-h-40 w-full resize-y rounded-2xl border-2 border-outline bg-surface px-5 py-4 text-left text-[15px] leading-relaxed text-ink shadow-[4px_4px_0_var(--outline)] placeholder:text-ink-3 transition-colors"
      />
      {emptyNudge && (
        <p role="alert" className="mt-3 text-center text-sm text-ink-2">
          Start with a sentence about what you&apos;re making.
        </p>
      )}
      <div className="mt-5 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={() => start(pitch)}
          className="btn-primary inline-flex min-h-11 items-center justify-center px-6 py-3 text-sm"
        >
          Find my audience
        </button>
        <button
          type="button"
          onClick={() => start(EXAMPLE_PITCH)}
          className="btn-secondary inline-flex min-h-11 items-center justify-center px-6 py-3 text-sm"
        >
          Try an example
        </button>
      </div>
    </section>
  );
}
