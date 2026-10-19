/**
 * The channel map: what each animated channel writes.
 *
 * A channel is a name the timeline animates ("w", "orb.spin", "pulse").
 * This module is the only place that knows where a channel lands: a CSS
 * custom property on the actor, a value on the orb renderer, a transform
 * on the trail. The runtime never touches the DOM for a channel itself.
 */

import { fmt } from "@/components/ui/orb/easing";
import { ORB_KEYS, type OrbRenderer } from "@/components/ui/orb/orb-canvas";
import type { Trail } from "@/components/ui/orb/trail";

export interface ChannelContext {
  /** The element the shape and colour channels are written to. */
  actor: HTMLElement;
  /** The stage root (the halo centre). */
  root: HTMLElement;
  /** The status line under the orb. */
  status: HTMLElement;
  /** The pulse ring. */
  pulse: HTMLElement;
  orb: OrbRenderer;
  trail: Trail;
  /** Move the orb along the flight path. */
  applyPath: () => void;
  /** Reveal the answer words. */
  applyWords: (v: number) => void;
}

export type ChannelMap = Record<string, (v: number) => void>;

export function createChannels(ctx: ChannelContext): ChannelMap {
  const { actor, root, status, pulse, orb, trail } = ctx;
  const CH: ChannelMap = {};

  [
    "oGlow",
    "oHalo",
    "oPill",
    "oBall",
    "oGreen",
    "oCard",
    "oRing",
    "oInput",
    "oAur",
    "gs",
    "cs",
    "hOp",
    "dotS",
    "bloom",
  ].forEach((n) => {
    CH[n] = (v) => actor.style.setProperty("--" + n, fmt(v));
  });
  ["w", "h", "r"].forEach((n) => {
    CH[n] = (v) => {
      actor.style.setProperty("--" + n, fmt(v) + "px");
      if (n === "w") trail.setDiameter(v);
    };
  });
  CH.sOp = (v) => status.style.setProperty("--sOp", fmt(v));
  CH.sTy = (v) => status.style.setProperty("--sTy", fmt(v));
  CH.cHalo = (v) => root.style.setProperty("--oCenter", fmt(v));
  CH.u = () => ctx.applyPath();
  CH.yOff = () => ctx.applyPath();
  CH.trail = (v) => trail.setVisible(v);
  CH.pulse = (v) => {
    if (v < 0) {
      pulse.style.opacity = "0";
      return;
    }
    pulse.style.opacity = fmt(0.5 * (1 - v));
    pulse.style.transform = `scale(${fmt(1 + v)})`;
  };
  CH.wp = (v) => ctx.applyWords(v);
  ORB_KEYS.forEach((name) => {
    CH["orb." + name] = (v) => {
      orb.P[name] = v;
      if (name === "alpha") orb.ensure();
    };
  });

  return CH;
}
