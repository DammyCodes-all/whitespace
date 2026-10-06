import Link from "next/link";

/**
 * Site shell header. Server Component, instant nav via Link.
 * Single line on desktop, 68px tall. Light-only per design-direction.
 */
export function SiteHeader() {
  return (
    <header className="border-b border-rule bg-paper print:hidden">
      <div className="mx-auto flex h-[68px] w-full max-w-6xl items-center justify-between px-6 sm:px-8">
        <Link
          href="/"
          className="font-mono text-sm tracking-tight text-ink transition-colors hover:text-measured"
        >
          Whitespace
        </Link>
        <nav aria-label="Primary" className="flex items-center gap-6">
          <Link
            href="/"
            className="text-sm text-ink-2 transition-colors hover:text-ink"
          >
            New fit
          </Link>
          <Link
            href="/run"
            className="text-sm text-ink-2 transition-colors hover:text-ink"
          >
            Read a sample result
          </Link>
        </nav>
      </div>
    </header>
  );
}
