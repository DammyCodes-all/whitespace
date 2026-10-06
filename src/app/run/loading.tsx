/**
 * Day 8 U: loading state for `/run` navigations (including constraint
 * rechecks). Static skeleton matching the result layout: no spinners,
 * no motion, honest under reduced-motion by construction.
 */
export default function RunLoading() {
  return (
    <main
      className="flex flex-1 flex-col"
      aria-busy="true"
      aria-label="Loading run"
    >
      <div className="mx-auto w-full max-w-3xl flex-1 px-6 py-12 sm:px-8">
        <p className="font-mono text-xs tracking-tight text-ink-3">
          Preparing run
        </p>
        <div className="mt-4 h-10 w-3/4 bg-rule" aria-hidden="true" />
        <div className="mt-8 border-t border-rule" aria-hidden="true">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="border-b border-rule py-4">
              <div className="h-4 w-1/2 bg-rule" />
              <div className="mt-2 h-3 w-1/3 bg-rule" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
