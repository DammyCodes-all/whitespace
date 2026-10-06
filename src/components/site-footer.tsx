/**
 * Site footer with the §6.10 honesty disclaimer.
 * Group-level taste data, no outcome predictions.
 */
export function SiteFooter() {
  return (
    <footer className="border-t border-rule bg-paper print:hidden">
      <div className="mx-auto w-full max-w-6xl px-6 py-8 sm:px-8">
        <p className="max-w-prose text-sm leading-relaxed text-ink-3">
          Built from group-level taste data. Results are a hypothesis, not a
          prediction of outcomes, and never replace talking to real people.
        </p>
      </div>
    </footer>
  );
}
