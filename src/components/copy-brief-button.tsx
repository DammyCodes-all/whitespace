"use client";

/**
 * Copy the targeting brief. Owned by U.
 *
 * The one interactive control inside the otherwise-server results view,
 * so it gets its own island instead of forcing the whole view into the
 * client bundle. Confirms in the same mono voice as the rest of the
 * page, and cleans its timer on unmount.
 */

import { useEffect, useRef, useState } from "react";
import { buildTargetingBrief } from "@/lib/flow/brief";
import type { FlowResult } from "@/lib/flow/contract";

export function CopyBriefButton({ result }: { result: FlowResult }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );

  return (
    <>
      <button
        type="button"
        className="btn-primary mt-3 px-5 py-2.5 text-sm"
        onClick={() => {
          void navigator.clipboard?.writeText(buildTargetingBrief(result));
          setCopied(true);
          if (timer.current !== null) clearTimeout(timer.current);
          timer.current = setTimeout(() => setCopied(false), 2000);
        }}
      >
        Copy as targeting brief
      </button>
      <output
        aria-live="polite"
        className="mt-2 block min-h-4 font-mono text-xs text-ink-3"
      >
        {copied ? "Copied to the clipboard." : ""}
      </output>
    </>
  );
}
