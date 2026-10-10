/**
 * Day 11 U: out-of-scope notice. Owned by U.
 *
 * Renders when the pipeline refuses a tool/app pitch
 * (`inconclusiveReason === "scope"`, §3, §6.7). Server Component. Plain
 * words: taste data cannot judge tools, why, and what to use instead.
 * No numbers, no fake run — the refusal IS the result.
 *
 * Spec ref: §3 (users are creators), §6.7 (Inconclusive honesty),
 * §6.10 (limits section), §10 #4 (no-data honesty).
 */

export function ScopeNotice({ pitchText }: { pitchText: string }) {
  return (
    <section
      aria-label="Outside what taste data can judge"
      className="card mt-8 p-5"
    >
      <p className="font-mono text-xs tracking-tight text-ink-3">
        out of scope · §3
      </p>
      <h2 className="mt-2 font-serif text-2xl tracking-tight text-ink">
        This looks like a tool, not a creative work.
      </h2>
      <p className="mt-2 max-w-prose text-body text-ink-2">
        Whitespace answers &ldquo;which taste crowd fits this work&rdquo; from
        what audiences over-index on — films, music, books, games. A tool unites
        people by a behavior (wanting free downloads), not by shared taste, and
        Qloo holds no app entities to build an audience from. So there is
        nothing honest to score here, and no run was spent pretending otherwise.
      </p>
      <p className="mt-3 max-w-prose font-mono text-xs text-ink-3">
        Your pitch: &ldquo;{pitchText.slice(0, 280)}
        {pitchText.length > 280 ? "…" : ""}&rdquo;
      </p>
      <ul className="mt-3 max-w-prose list-disc space-y-1 pl-5 text-sm text-ink-2">
        <li>
          If this is a film, album, book, or game pitch, reword it as the work
          itself (story, setting, mood) and run again.
        </li>
        <li>
          If it really is an app or bot, user interviews and behavior data fit
          better than taste data — this tool will keep refusing those, by
          design.
        </li>
      </ul>
    </section>
  );
}
