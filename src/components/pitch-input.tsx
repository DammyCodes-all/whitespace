"use client";

/**
 * Pitch textarea plus word count. Owned by U.
 *
 * Section of `./pitch-form.tsx` (§6.1). Controlled: the shell owns the
 * text, this renders it with the limit notice.
 */

import { countWords, WORD_LIMIT } from "@/components/pitch-form-utils";

export function PitchInput({
  pitch,
  onPitchChange,
  wasTrimmed,
  disabled = false,
}: {
  pitch: string;
  onPitchChange: (value: string) => void;
  wasTrimmed: boolean;
  /** True while AI proposals load, closing the stale-pitch race. */
  disabled?: boolean;
}) {
  const words = countWords(pitch);
  return (
    <div>
      <label
        htmlFor="pitch"
        className="mt-4 block text-lg tracking-tight text-ink"
      >
        Paste your idea
      </label>
      <textarea
        id="pitch"
        value={pitch}
        onChange={(e) => onPitchChange(e.target.value)}
        rows={5}
        required
        disabled={disabled}
        placeholder="A quiet science-fiction film about a lonely worker on a space station."
        className="mt-2 w-full border border-rule bg-surface px-3 py-2 text-[15px] text-ink placeholder:text-ink-3 disabled:opacity-60"
      />
      <p data-numeric className="mt-1 font-mono text-xs text-ink-3">
        {words} / {WORD_LIMIT} words
        {words > WORD_LIMIT && " · will trim on confirm"}
      </p>
      {wasTrimmed && (
        <p className="mt-1 font-mono text-xs text-ink-2">
          Trimmed to {WORD_LIMIT} words.
        </p>
      )}
    </div>
  );
}
