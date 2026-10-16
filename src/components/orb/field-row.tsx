"use client";

/**
 * One input + one action button on a single row: full width stacked on
 * mobile, side by side from `sm` up. Shared by the tags add-word row
 * and the titles check row so both measure exactly the same.
 */

export function FieldRow({
  id,
  value,
  onChange,
  placeholder,
  ariaLabel,
  inputDisabled = false,
  onEnter,
  actionLabel,
  onAction,
  actionDisabled = false,
}: {
  /** Optional input id (associates an outer label via htmlFor). */
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  ariaLabel: string;
  inputDisabled?: boolean;
  /** Optional submit-on-Enter (the tags row adds on Enter). */
  onEnter?: () => void;
  actionLabel: string;
  onAction: () => void;
  actionDisabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && onEnter !== undefined) {
            e.preventDefault();
            onEnter();
          }
        }}
        placeholder={placeholder}
        aria-label={ariaLabel}
        disabled={inputDisabled}
        className="min-w-0 flex-1 border-2 border-outline bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-ink-3"
      />
      <button
        type="button"
        onClick={onAction}
        disabled={actionDisabled}
        className="btn-secondary shrink-0 px-5 py-2.5 text-sm"
      >
        {actionLabel}
      </button>
    </div>
  );
}
