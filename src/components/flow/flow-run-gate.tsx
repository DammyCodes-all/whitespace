"use client";

import LoadingState from "@/components/ui/loading-state";
import { MIN_MATCHED_TAGS } from "@/lib/config";

/**
 * Run gate: analysis + edit-pitch actions with the titles-floor hint.
 * Spec: §6.1, §6.2 (copy unchanged).
 */
export function FlowRunGate({
  matched,
  titleTagCount,
  parsedCount,
  busy,
  error,
  onRun,
  onEditPitch,
}: {
  matched: number;
  titleTagCount: number;
  parsedCount: number;
  busy: boolean;
  error: string | null;
  onRun: () => void;
  onEditPitch: () => void;
}) {
  return (
    <>
      <div className="mt-6 flex flex-wrap items-center gap-4">
        {busy ? (
          <output aria-live="polite" className="block py-1">
            <LoadingState label="Running pitch" variant="Dots" />
          </output>
        ) : (
          <button
            type="button"
            onClick={onRun}
            disabled={
              matched + titleTagCount < MIN_MATCHED_TAGS || parsedCount < 1
            }
            className="btn-primary px-6 py-3 text-sm"
          >
            Run the analysis
          </button>
        )}
        <button
          type="button"
          onClick={onEditPitch}
          className="btn-secondary px-5 py-3 text-sm"
        >
          Edit the pitch
        </button>
      </div>
      {parsedCount < 1 && (
        <output className="mt-3 block font-mono text-xs text-clay">
          Add at least 1 similar title — the run grounds its tags in it, and the
          pool gate still applies.
        </output>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-ink-2">
          {error}
        </p>
      )}
    </>
  );
}
