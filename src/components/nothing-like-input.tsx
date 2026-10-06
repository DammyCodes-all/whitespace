"use client";

/**
 * "Nothing like" title slots. Owned by U.
 *
 * Section of `./pitch-form.tsx` (§6.1). Fixed slots, order never
 * changes; entries feed the Day 5 exclusion audience.
 */

import { NOTHING_LIKE_LIMIT } from "@/components/pitch-form-utils";

export function NothingLikeInput({
  values,
  onChangeAt,
  onAdd,
}: {
  values: string[];
  onChangeAt: (index: number, value: string) => void;
  onAdd: () => void;
}) {
  return (
    <fieldset className="min-w-0 flex-1">
      <legend className="font-mono text-xs text-ink-3">
        Nothing like (up to {NOTHING_LIKE_LIMIT}, optional)
      </legend>
      {values.map((value, i) => (
        <input
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed slots, order never changes
          key={i}
          value={value}
          onChange={(e) => onChangeAt(i, e.target.value)}
          placeholder={`Nothing like #${i + 1}`}
          aria-label={`Nothing like ${i + 1}`}
          className="mt-1 w-full border border-rule bg-surface px-2 py-1.5 text-sm text-ink placeholder:text-ink-3"
        />
      ))}
      {values.length < NOTHING_LIKE_LIMIT && (
        <button
          type="button"
          onClick={onAdd}
          className="mt-2 font-mono text-xs text-measured underline underline-offset-4"
        >
          + add another
        </button>
      )}
    </fieldset>
  );
}
