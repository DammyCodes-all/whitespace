"use client";

/**
 * Day 9 U: print island for the audience case. Owned by U.
 *
 * Client-only (window.print); hidden on paper itself.
 */
export function CasePrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-block border border-rule px-5 py-2.5 text-sm text-ink transition-colors print:hidden hover:border-ink"
    >
      Print / save PDF
    </button>
  );
}
