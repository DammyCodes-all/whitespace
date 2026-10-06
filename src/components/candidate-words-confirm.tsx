"use client";

/**
 * Day 6.5 U: candidate descriptive words with must-have pins. Owned by U.
 *
 * Section of `./pitch-form.tsx` (§6.5, §6.6). Words come from the LLM
 * seam; each is checked against Qloo tags at run time. Pinned words are
 * passed as `pinnedWords` and count double in scoring.
 */

export function CandidateWordsConfirm({
  words,
  pinned,
  draft,
  onDraftChange,
  onAddDraft,
  onTogglePin,
  onRemove,
}: {
  words: string[];
  pinned: string[];
  draft: string;
  onDraftChange: (value: string) => void;
  onAddDraft: () => void;
  onTogglePin: (word: string) => void;
  onRemove: (word: string) => void;
}) {
  const pinnedSet = new Set(pinned.map((w) => w.toLowerCase()));
  return (
    <div>
      <h3 className="mt-8 text-lg tracking-tight text-ink">
        Descriptive words — pin the must-haves
      </h3>
      <p className="mt-1 font-mono text-xs text-ink-3">
        Checked against Qloo tags at run time; pinned words count double.
      </p>
      <ul className="mt-3 border-t border-rule">
        {words.map((word) => {
          const isPinned = pinnedSet.has(word.toLowerCase());
          return (
            <li
              key={word.toLowerCase()}
              className="flex items-baseline justify-between gap-4 border-b border-rule py-2"
            >
              <label className="flex cursor-pointer items-baseline gap-2 text-[15px] text-ink">
                <input
                  type="checkbox"
                  checked={isPinned}
                  onChange={() => onTogglePin(word)}
                  aria-label={`Pin ${word} as must-have`}
                  className="translate-y-px accent-[#1d4ed8]"
                />
                {word}{" "}
                <span className="font-mono text-xs text-ink-3">
                  {isPinned ? "pinned ×2" : "pin to double"}
                </span>
              </label>
              <button
                type="button"
                onClick={() => onRemove(word)}
                aria-label={`Remove ${word}`}
                className="shrink-0 font-mono text-xs text-ink-3 underline underline-offset-4 hover:text-ink"
              >
                remove
              </button>
            </li>
          );
        })}
        {words.length === 0 && (
          <li className="border-b border-rule py-2 font-mono text-xs text-ink-3">
            No words yet — get AI suggestions or add your own below.
          </li>
        )}
      </ul>
      <div className="mt-3 flex gap-2">
        <input
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          placeholder="Add a descriptive word"
          aria-label="Add a descriptive word"
          className="min-w-0 flex-1 border border-rule bg-surface px-2 py-1.5 text-sm text-ink placeholder:text-ink-3"
        />
        <button
          type="button"
          onClick={onAddDraft}
          className="shrink-0 border border-rule px-3 py-1.5 text-sm text-ink"
        >
          Add
        </button>
      </div>
    </div>
  );
}
