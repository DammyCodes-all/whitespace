"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Site shell header. Client pathname awareness, instant nav via Link.
 * Single line on desktop, 68px tall. Light-only per design-direction.
 */
export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="bg-paper print:hidden">
      <div className="mx-auto flex h-[68px] w-full max-w-6xl items-center justify-between px-6 sm:px-8">
        <Link
          href="/"
          className="font-mono text-sm tracking-tight text-ink transition-colors hover:text-measured"
        >
          Whitespace
        </Link>
        <nav aria-label="Primary" className="flex items-center gap-3 sm:gap-6">
          {pathname !== "/" && (
            <Link
              href="/"
              className="text-sm text-ink-2 transition-colors hover:text-ink"
            >
              New analysis
            </Link>
          )}
          <Link
            href="/run"
            className="text-sm text-ink-2 transition-colors hover:text-ink"
          >
            Legacy v1 sample
          </Link>
        </nav>
      </div>
    </header>
  );
}
