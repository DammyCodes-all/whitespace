"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SampleRunLink } from "@/components/demo/sample-run-link";

/**
 * Site shell header. Server Component, instant nav via Link.
 * Single line on desktop, 68px tall. Light-only per design-direction.
 */
export function SiteHeader() {
  const pathname = usePathname();
  // The sample-run link is redundant inside the sample itself.
  const inSampleFlow = pathname === "/demo/flow" || pathname === "/demo/run";

  return (
    <header className="bg-paper print:hidden">
      <div className="mx-auto flex h-[68px] w-full max-w-6xl items-center justify-between px-6 sm:px-8">
        <Link
          href="/"
          className="font-mono text-sm tracking-tight text-ink transition-colors hover:text-measured"
        >
          Whitespace
        </Link>
        <nav aria-label="Primary" className="flex items-center gap-2 sm:gap-5">
          {pathname !== "/" && (
            <Link
              href="/"
              className="text-sm text-ink-2 transition-colors hover:text-ink"
            >
              New fit
            </Link>
          )}
          <Link
            href="/demo/result"
            className="hidden text-sm text-ink-2 transition-colors hover:text-ink sm:inline"
          >
            Read a sample result
          </Link>
          {!inSampleFlow && <SampleRunLink />}
        </nav>
      </div>
    </header>
  );
}
