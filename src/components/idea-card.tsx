"use client";

/**
 * The idea card: the pitch as it was read, the run's meta line, and a
 * "See more" control. The preview holds at 3 lines so a long pitch
 * never becomes a wall of text under the verdict — the user typed it,
 * so the rest sits one click away. Short pitches show no control.
 *
 * Spec ref: §6.10 (what the result page carries). The spec does not
 * require echoing the pitch; this card is presentation only.
 */

import { useEffect, useId, useRef, useState } from "react";

/** Preview height before "See more". */
const LINES = 3;

/**
 * True when the text wraps past `lines` lines at the current width.
 * The clamped scroll height catches the clipped case; the range's line
 * boxes catch it when scroll height reports nothing (and while the
 * card is expanded, where the clamp is off).
 */
function overflows(el: HTMLElement, lines: number): boolean {
  if (el.scrollHeight > el.clientHeight + 1) return true;
  const range = document.createRange();
  range.selectNodeContents(el);
  const tops = new Set<number>();
  for (const rect of range.getClientRects()) {
    if (rect.height > 0) tops.add(Math.round(rect.top));
  }
  return tops.size > lines;
}

export interface IdeaCardProps {
  pitch: string;
  /** Meta line under the pitch (type · run · Qloo calls). */
  meta: string;
  /** Id for the pitch so a section's aria-labelledby keeps resolving;
   *  also renders the pitch as the h2 instead of a p. */
  headingId?: string;
  /** Extra classes for the card shell (page-level spacing). */
  className?: string;
}

export function IdeaCard({
  pitch,
  meta,
  headingId,
  className = "",
}: IdeaCardProps) {
  const pitchRef = useRef<HTMLElement | null>(null);
  const fallbackPitchId = useId();
  const pitchId = headingId ?? fallbackPitchId;
  const [expanded, setExpanded] = useState(false);
  const [clipped, setClipped] = useState(false);

  useEffect(() => {
    const el = pitchRef.current;
    if (el === null) return;
    const measure = () => setClipped(overflows(el, LINES));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    // The serif swap can rewrap the lines after first paint.
    void document.fonts.ready.then(measure, () => undefined);
    return () => ro.disconnect();
  }, []);

  // A new idea shows collapsed: the previous run's expansion is not
  // this run's business. The clamped box never changes size when the
  // text grows, so measure here too — the observer can't see it.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset + re-measure when a new idea arrives
  useEffect(() => {
    setExpanded(false);
    const el = pitchRef.current;
    if (el !== null) setClipped(overflows(el, LINES));
  }, [pitch]);

  const PitchTag = headingId === undefined ? "p" : "h2";

  return (
    <section
      aria-labelledby={headingId}
      aria-label={headingId === undefined ? "The idea" : undefined}
      className={`rounded-[18px] border-2 border-outline bg-surface p-5 shadow-[4px_4px_0_var(--outline)] sm:p-7 ${className}`}
    >
      <p className="font-mono text-xs uppercase tracking-[0.14em] text-ink-3">
        The idea
      </p>
      <PitchTag
        id={pitchId}
        ref={(node: HTMLElement | null) => {
          pitchRef.current = node;
        }}
        className={`mt-3 max-w-3xl font-serif text-2xl leading-tight tracking-tight text-ink sm:text-3xl ${
          expanded ? "" : "line-clamp-3"
        }`}
      >
        {pitch}
      </PitchTag>
      {clipped ? (
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={pitchId}
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 font-mono text-xs text-ink-2 underline decoration-dotted decoration-ink-3 underline-offset-[5px] hover:text-ink"
        >
          {expanded ? "See less" : "See more"}
        </button>
      ) : null}
      <p className="mt-3 font-mono text-xs text-ink-3">{meta}</p>
    </section>
  );
}
