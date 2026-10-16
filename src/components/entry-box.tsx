"use client";

/**
 * The landing entry: a plain pitch box, no orb. Submit hands off to the
 * blank run page (/run?pitch=…) — the ViewTransitions wrapper in the
 * root layout animates the move (next-view-transitions holds the
 * snapshot across Next's async navigation, which a bare
 * startViewTransition call cannot).
 */

import { useTransitionRouter } from "next-view-transitions";
import { useEffect, useId, useRef, useState } from "react";

export const PITCH_PLACEHOLDER =
  "Tell us about your story: premise, mood, themes, and setting. More detail means better tags. Something like: a gritty but tender heist movie about loyalty and aging out.";

export const EXAMPLE_PITCH =
  "Frankie drove getaway cars for twenty years and never lost a crew — now her old crew is back with one last casino job, and her teenage nephew begs to ride along. Gritty but tender, about loyalty and aging out; a heist movie with family drama at its core, not a glossy action romp.";

const STORED_KEY = "whitespace-pitch";
const FLIGHT_KEY = "whitespace-flight";

export interface FlightRect {
  left: number;
  top: number;
  width: number;
  height: number;
  /** "ball" = entry already morphed card → ink ball in place; the clone
   *  flies as a ball and the runtime joins at the ball. Absent = legacy
   *  card rect (still morphs in flight for the 30s freshness window). */
  shape?: "ball";
}

/** Read the stored flight box without consuming it (freshness-checked). */
export function peekFlight(): FlightRect | null {
  try {
    const raw = window.sessionStorage.getItem(FLIGHT_KEY);
    if (raw === null) return null;
    const p = JSON.parse(raw) as Partial<FlightRect> & { t?: unknown };
    if (
      typeof p.left !== "number" ||
      typeof p.top !== "number" ||
      typeof p.width !== "number" ||
      typeof p.height !== "number" ||
      !(p.width > 0 && p.height > 0) ||
      typeof p.t !== "number" ||
      Date.now() - p.t > 30000
    ) {
      return null;
    }
    return {
      left: p.left,
      top: p.top,
      width: p.width,
      height: p.height,
      ...(p.shape === "ball" ? { shape: "ball" as const } : {}),
    };
  } catch {
    return null;
  }
}

/** Consume the stored flight box. */
export function clearFlight(): void {
  try {
    window.sessionStorage.removeItem(FLIGHT_KEY);
  } catch {
    // Storage is a convenience, never a gate.
  }
}

export function EntryBox({
  target = "/run",
  storageKey = STORED_KEY,
}: {
  target?: string;
  /** Pitch persistence key — the demo entry passes its own so demo
   *  text never prefills (or overwrites) the main landing box. */
  storageKey?: string;
}) {
  const router = useTransitionRouter();
  const [value, setValue] = useState("");
  const fieldId = useId();
  const cardRef = useRef<HTMLDivElement>(null);
  const morphingRef = useRef(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: mount-only prefill
  useEffect(() => {
    try {
      const stored = window.sessionStorage.getItem(storageKey);
      if (stored !== null && stored !== "") setValue(stored);
    } catch {
      // Private mode or blocked storage: the box just starts empty.
    }
  }, []);

  function go(pitch: string) {
    const trimmed = pitch.trim();
    if (trimmed === "" || morphingRef.current) return;
    // Navigate at once — the morph happens on the run page, inside
    // the move (the clone flies + reshapes card → ball there). Never
    // hold the user on landing while a morph plays out.
    morphingRef.current = true;
    window.setTimeout(() => {
      morphingRef.current = false;
    }, 2000);
    try {
      window.sessionStorage.setItem(storageKey, trimmed);
      const r = cardRef.current?.getBoundingClientRect();
      if (r !== undefined && r.width > 0 && r.height > 0) {
        // Viewport rect: the clone is fixed, and the run page opens at
        // the top, so viewport coords land it where the box just was.
        const flight: FlightRect & { t: number } = {
          left: r.left,
          top: r.top,
          width: r.width,
          height: r.height,
          t: Date.now(),
        };
        window.sessionStorage.setItem(FLIGHT_KEY, JSON.stringify(flight));
      }
    } catch {
      // Storage is a convenience, never a gate.
    }
    router.push(`${target}?pitch=${encodeURIComponent(trimmed)}`);
  }

  const ready = value.trim() !== "";

  return (
    <form
      aria-label="Pitch entry"
      onSubmit={(e) => {
        e.preventDefault();
        go(value);
      }}
    >
      <div className="card h-[200px] px-5 pb-3 pt-4" ref={cardRef}>
        <label htmlFor={fieldId} className="sr-only">
          Tell us about your story
        </label>
        <textarea
          id={fieldId}
          value={value}
          rows={5}
          maxLength={2000}
          placeholder={PITCH_PLACEHOLDER}
          onChange={(e) => setValue(e.target.value)}
          className="h-full w-full resize-none bg-transparent text-[15px] leading-[1.6] text-ink placeholder:text-ink-3 focus:outline-none"
        />
      </div>

      <div className="mt-5 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
        <button
          type="submit"
          disabled={!ready}
          className="btn-primary inline-flex min-h-11 items-center justify-center px-6 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          Find my audience
        </button>
        <button
          type="button"
          onClick={() => go(EXAMPLE_PITCH)}
          className="btn-secondary inline-flex min-h-11 items-center justify-center px-6 py-3 text-sm"
        >
          Try an example
        </button>
      </div>
    </form>
  );
}
