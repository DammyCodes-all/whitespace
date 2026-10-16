"use client";

import { useId } from "react";
import LoadingState from "@/components/ui/loading-state";

/**
 * Step 1: pitch + optional similar titles.
 * Heading contract: h1#flow-input-heading labels section.
 * Spec: §6.1 (input copy unchanged).
 */
export function FlowInputStep({
  pitchText,
  similarTitles,
  busy,
  error,
  onPitchChange,
  onSimilarChange,
  onExtract,
}: {
  pitchText: string;
  similarTitles: string;
  busy: boolean;
  error: string | null;
  onPitchChange: (v: string) => void;
  onSimilarChange: (v: string) => void;
  onExtract: () => void;
}) {
  const pitchId = useId();
  const similarId = useId();
  return (
    <section aria-labelledby="flow-input-heading">
      <h1
        id="flow-input-heading"
        className="font-serif text-3xl tracking-tight text-ink"
      >
        What are you making?
      </h1>
      <p id="flow-input-lede" className="mt-2 max-w-prose text-body text-ink-2">
        Explain it in detail — the world, the characters, what happens, what it
        is about underneath. More detail means better tags and a fairer verdict.
        We read its tags, check them against real Qloo data, and show which
        audience it fits.
      </p>
      <label htmlFor={pitchId} className="sr-only">
        Explain your idea in detail
      </label>
      <textarea
        id={pitchId}
        value={pitchText}
        onChange={(e) => onPitchChange(e.target.value)}
        rows={10}
        aria-describedby="flow-input-lede"
        placeholder="Frankie drove getaway cars for twenty years and never lost a crew. Now her old crew is back with one last job. Gritty but tender, slow-burn. About loyalty and aging out of a life, set in a present-day port town that lives off smuggling crews. A heist movie with family drama at its core."
        className="mt-4 min-h-40 w-full resize-y rounded-2xl border-2 border-outline bg-surface px-5 py-4 text-left text-[15px] leading-relaxed text-ink shadow-[4px_4px_0_var(--outline)] placeholder:text-ink-3 transition-colors focus:outline-none focus:ring-2 focus:ring-measured/30"
      />
      <div className="mt-4">
        <div>
          <label
            htmlFor={similarId}
            className="block font-mono text-xs text-ink-3"
          >
            Similar to (optional here — required before the run, comma separated
            — suggestions appear after you check them)
          </label>
          <input
            id={similarId}
            value={similarTitles}
            onChange={(e) => onSimilarChange(e.target.value)}
            placeholder="Moon, Arrival"
            className="mt-1 w-64 border-2 border-outline bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-3"
          />
        </div>
      </div>
      {busy ? (
        <output aria-live="polite" className="mt-6 block">
          <LoadingState label="Running pitch" variant="Dots" />
        </output>
      ) : (
        <button
          type="button"
          onClick={onExtract}
          disabled={pitchText.trim() === ""}
          className="btn-primary mt-6 px-6 py-3 text-sm"
        >
          Read the tags
        </button>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-ink-2">
          {error}
        </p>
      )}
    </section>
  );
}
