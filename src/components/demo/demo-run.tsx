"use client";

import { useRef } from "react";
import { OrbFlow } from "@/components/orb-flow";
import { installDemoFetch } from "@/lib/demo/demo-fetch";

/**
 * Blank demo run: the fixture fetch shim installs during render (parent
 * renders before OrbFlow's ?pitch= autostart effect fires, so the very
 * first tags call is already shimmed), then the same OrbFlow as /run.
 * Zero AI, zero Qloo. The shim stays installed for the session.
 */
export function DemoRun() {
  const installedRef = useRef(false);
  if (typeof window !== "undefined" && !installedRef.current) {
    installedRef.current = true;
    installDemoFetch();
  }
  return <OrbFlow homeHref="/demo/flow" />;
}
