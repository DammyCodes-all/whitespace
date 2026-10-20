/**
 * The honesty notice above the recorded result. It says what the page
 * is, when the run happened, and what the reader can check.
 */

export function RecordedRunNotice({
  recordedAt,
  calls,
  audiences,
  controls,
  grounded,
}: {
  recordedAt: string;
  calls: number;
  audiences: number;
  controls: number;
  grounded: boolean;
}) {
  return (
    <aside
      aria-label="About this recorded run"
      className="card mt-10 bg-surface p-5 sm:p-6"
    >
      <p className="font-mono text-xs uppercase tracking-[0.14em] text-measured">
        recorded live run
      </p>
      <p className="mt-2 max-w-prose text-body text-ink-2">
        This page replays one real Qloo run from {recordedAt}: {calls} Qloo
        calls, {audiences} scored audiences, including {controls} controls. It
        makes no Qloo or AI calls now.{" "}
        {grounded
          ? "Every title, tag and entity id below passed the run's grounding check."
          : "The run's grounding check did not pass; treat the output as unverified."}
      </p>
      <p className="mt-2 max-w-prose text-sm text-ink-3">
        Response bodies in the evidence drawer are trimmed to keep the page
        light. Request parameters, statuses and the full call count are
        complete.
      </p>
    </aside>
  );
}
