"use client";

/**
 * Change and re-check: one constraint in, the before/after in. The
 * check runs only on submit — typing never spends a call.
 */

import { ChangeView } from "@/components/change";
import type { ChangedRun } from "@/lib/pipeline/change";

export function ChangeRecheck({
  constraint,
  onConstraintChange,
  busy,
  error,
  changed,
  onCheck,
}: {
  constraint: string;
  onConstraintChange: (value: string) => void;
  busy: boolean;
  error: string | null;
  changed: ChangedRun | null;
  onCheck: () => void;
}) {
  return (
    <>
      <h2 className="text-lg tracking-tight text-ink">Change and re-check</h2>
      <p className="mt-1 text-sm leading-relaxed text-ink-2">
        A constraint can change the pitch, but the new version has to score
        higher to land.
      </p>
      <form
        className="mt-3"
        onSubmit={(e) => {
          e.preventDefault();
          onCheck();
        }}
      >
        <label
          htmlFor="orb-constraint"
          className="block font-mono text-xs text-ink-3"
        >
          Limit (for example a smaller budget)
        </label>
        <div className="mt-1 flex flex-col gap-2 sm:flex-row">
          <input
            id="orb-constraint"
            value={constraint}
            onChange={(e) => onConstraintChange(e.target.value)}
            maxLength={140}
            placeholder="Lower budget"
            className="min-w-0 flex-1 border-2 border-outline bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-3"
          />
          <button
            type="submit"
            disabled={constraint.trim() === "" || busy}
            className="btn-primary shrink-0 px-5 py-2 text-sm"
          >
            {busy ? "Checking…" : "Check change"}
          </button>
        </div>
      </form>
      {error !== null && (
        <p role="alert" className="mt-3 text-sm text-ink-2">
          {error}
        </p>
      )}
      {changed !== null && (
        <div className="mt-4">
          <ChangeView changed={changed} />
        </div>
      )}
    </>
  );
}
